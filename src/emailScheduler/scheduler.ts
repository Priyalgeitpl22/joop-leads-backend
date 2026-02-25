import { CampaignStatus, PrismaClient, CampaignLead, Lead } from "@prisma/client";
import { emailQueue } from "./queue";
import { dayKeyInTz, isWithinSchedule } from "./time";
import { lockCampaign, unlockCampaign, lockSender, unlockSender } from "./locks";
import { TriggerContext, TriggerStatus } from "./types";

const prisma = new PrismaClient();

type CampaignLeadWithLead = CampaignLead & { lead: Lead | null };

async function saveTriggerLog(ctx: TriggerContext) {
  const durationMs = Date.now() - ctx.startTime.getTime();

  try {
    await prisma.campaignTriggerLog.create({
      data: {
        campaignId: ctx.campaignId,
        triggeredAt: ctx.startTime,
        timezone: ctx.timezone,
        nextTriggerAt: ctx.nextTriggerAt,
        totalEmailsSent: ctx.totalEmailsSent,
        newLeadEmails: ctx.newLeadEmails,
        followUpEmails: ctx.followUpEmails,
        status: ctx.status,
        activityLog: ctx.activityLog.join("\n"),
        senderDetails: JSON.stringify(ctx.senderDetails),
        leadDetails: JSON.stringify(ctx.leadDetails),
        durationMs,
      },
    });
    console.log(`[Scheduler] Saved trigger log for campaign ${ctx.campaignId}`);
  } catch (err) {
    console.log(`[Scheduler] Could not save trigger log (run prisma migrate): ${err}`);
  }
}

export async function schedulerTick() {
  console.log("[Scheduler] ========== TICK START ==========", new Date().toISOString());
  console.log(`[Scheduler] process.env.NODE_ENV: ${process.env.NODE_ENV}`);
  const due = await prisma.campaignRuntime.findMany({
    where: { nextRunAt: { lte: new Date() }, campaign: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.SCHEDULED] } } },
    include: { campaign: true },
    orderBy: { campaign: { createdAt: 'desc' } },
  });

  console.log(`[Scheduler] Found ${due.length} due campaign(s)`);

  for (const rt of due) {
    let c = rt.campaign;
    console.log(`[Scheduler] Processing campaign: ${c?.name} (${c?.id}), status: ${c?.status}`);

    // Initialize trigger context
    const triggerCtx: TriggerContext = {
      startTime: new Date(),
      campaignId: c?.id || "",
      timezone: c?.timezone || "UTC",
      nextTriggerAt: null,
      totalEmailsSent: 0,
      newLeadEmails: 0,
      followUpEmails: 0,
      status: TriggerStatus.SUCCESS,
      activityLog: [],
      senderDetails: {},
      leadDetails: [],
    };

    // Auto-activate SCHEDULED campaigns when their scheduled time has arrived
    if (c?.status === CampaignStatus.SCHEDULED) {
      console.log(`[Scheduler] Auto-activating SCHEDULED campaign ${c.id}`);
      c = await prisma.campaign.update({
        where: { id: c.id },
        data: { status: CampaignStatus.ACTIVE, startedAt: new Date() },
      });
      triggerCtx.activityLog.push("Campaign auto-activated from SCHEDULED to ACTIVE");
    }

    const isActive = c?.status === CampaignStatus.ACTIVE;
    if (!isActive) {
      console.log(`[Scheduler] Skipping campaign ${c?.id} - not ACTIVE or SCHEDULED`);
      triggerCtx.status = TriggerStatus.SKIPPED;
      triggerCtx.activityLog.push(`Campaign skipped - status is ${c?.status}`);
      // await saveTriggerLog(triggerCtx);
      continue;
    }

    const gotLock = await lockCampaign(c.id);
    if (!gotLock) {
      console.log(`[Scheduler] Could not acquire lock for campaign ${c.id} - skipping`);
      triggerCtx.activityLog.push("Could not acquire campaign lock - another process may be handling this campaign");
      triggerCtx.status = TriggerStatus.SKIPPED;
      // await saveTriggerLog(triggerCtx);
      continue;
    }
    console.log(`[Scheduler] Acquired lock for campaign ${c.id}`);

    try {
      const tz = c.timezone;
      const dk = dayKeyInTz(tz);
      triggerCtx.timezone = tz;
      console.log(`[Scheduler] Campaign timezone: ${tz}, dayKey: ${dk}`);

      // reset daily counters if day changed
      if (rt.dayKey !== dk) {
        console.log(`[Scheduler] Day changed (${rt.dayKey} -> ${dk}), resetting counters`);
        await prisma.campaignRuntime.update({
          where: { campaignId: c.id },
          data: { dayKey: dk, sentToday: 0 },
        });
        triggerCtx.activityLog.push(`Day changed from ${rt.dayKey} to ${dk}, daily counters reset`);
      }

      // Always push nextRunAt forward first (crash-safe)
      // Calculate from the previous scheduled time to maintain exact intervals
      const nextRun = new Date(rt.nextRunAt.getTime() + c.intervalMinutes * 60_000);
      triggerCtx.nextTriggerAt = nextRun;
      console.log(`[Scheduler] Setting nextRunAt to ${nextRun.toISOString()} (interval: ${c.intervalMinutes} min, from previous: ${rt.nextRunAt.toISOString()})`);
      await prisma.campaignRuntime.update({
        where: { campaignId: c.id },
        data: { nextRunAt: nextRun },
      });

      // (3)(4) schedule/day/time/timezone gate
      const withinSchedule = isWithinSchedule({
        timezone: tz,
        sendDays: c.sendDays,
        windowStart: c.windowStart,
        windowEnd: c.windowEnd,
      });
      console.log(`[Scheduler] Within schedule window: ${withinSchedule} (days: ${c.sendDays}, window: ${c.windowStart}-${c.windowEnd})`);
      if (!withinSchedule) {
        console.log(`[Scheduler] Outside schedule window - skipping`);
        triggerCtx.status = TriggerStatus.OUTSIDE_SCHEDULE;
        triggerCtx.activityLog.push(`Outside schedule window (${c.sendDays.join(", ")}, ${c.windowStart}-${c.windowEnd} ${tz})`);
        // await saveTriggerLog(triggerCtx);
        continue;
      }

      // (1) campaign max/day gate
      const freshRt = await prisma.campaignRuntime.findUnique({ where: { campaignId: c.id } });
      if (!freshRt) {
        console.log(`[Scheduler] No runtime found for campaign ${c.id} - skipping`);
        triggerCtx.status = TriggerStatus.ERROR;
        triggerCtx.activityLog.push("No campaign runtime found");
        // await saveTriggerLog(triggerCtx);
        continue;
      }
      console.log(`[Scheduler] Campaign sentToday: ${freshRt.sentToday}, maxEmailsPerDay: ${c.maxEmailsPerDay}`);
      if (freshRt.sentToday >= c.maxEmailsPerDay) {
        console.log(`[Scheduler] Campaign ${c.id} reached daily limit - skipping`);
        triggerCtx.status = TriggerStatus.DAILY_LIMIT;
        triggerCtx.activityLog.push(`Daily limit reached (${freshRt.sentToday}/${c.maxEmailsPerDay} emails sent today)`);
        // await saveTriggerLog(triggerCtx);
        continue;
      }

      // load senders
      // const senders = await prisma.senderAccount.findMany({
      //   where: { isEnabled: true },
      // });

      const campaignSenders = await prisma.campaignSender.findMany({
        where: { campaignId: c.id },
        include: { sender: true },
      });

      const senders = campaignSenders.map((cs) => cs.sender);
      
      console.log(`[Scheduler] Found ${senders.length} enabled sender account(s)`);
      triggerCtx.activityLog.push(`Found ${senders.length} enabled sender account(s)`);

      // For each sender: enqueue max 1 email per run (Smartlead pattern)
      for (const sender of senders) {
        console.log(`[Scheduler] Processing sender: ${sender.email} (${sender.id})`);

        // Initialize sender detail
        triggerCtx.senderDetails[sender.email] = {
          email: sender.email,
          sent: 0,
          skipped: false,
        };

        // Stop if campaign reached max/day during this loop
        const current = await prisma.campaignRuntime.findUnique({ where: { campaignId: c.id } });
        if (!current || current.sentToday >= c.maxEmailsPerDay) {
          console.log(`[Scheduler] Campaign ${c.id} reached daily limit mid-loop - breaking`);
          triggerCtx.activityLog.push("Campaign daily limit reached during processing");
          break;
        }

        const senderLocked = await lockSender(sender.id, dk);
        if (!senderLocked) {
          console.log(`[Scheduler] Could not lock sender ${sender.id} - skipping`);
          triggerCtx.senderDetails[sender.email].skipped = true;
          triggerCtx.senderDetails[sender.email].skipReason = "Could not acquire lock";
          continue;
        }
        console.log(`[Scheduler] Acquired lock for sender ${sender.id}`);

        try {
          const srt = await prisma.senderRuntime.findUnique({
            where: { senderId_dayKey: { senderId: sender.id, dayKey: dk } },
          });

          const sentToday = srt?.sentToday ?? 0;
          const lastSentAt = srt?.lastSentAt ?? null;
          console.log(`[Scheduler] Sender ${sender.email}: sentToday=${sentToday}, dailyLimit=${sender.dailyLimit}, lastSentAt=${lastSentAt?.toISOString() ?? 'never'}`);

          // (5) sender daily limit gate
          if (sentToday >= sender.dailyLimit) {
            console.log(`[Scheduler] Sender ${sender.email} reached daily limit - skipping`);
            triggerCtx.senderDetails[sender.email].skipped = true;
            triggerCtx.senderDetails[sender.email].skipReason = `Daily limit reached (${sentToday}/${sender.dailyLimit})`;
            continue;
          }

          // (6) sender gap must be >= campaign intervalMinutes
          // Add 5 second tolerance for timing jitter (scheduler tick timing isn't perfect)
          if (lastSentAt) {
            const diffMin = (Date.now() - lastSentAt.getTime()) / 60_000;
            const toleranceMin = 5 / 60; // 5 seconds tolerance
            console.log(`[Scheduler] Time since last send: ${diffMin.toFixed(2)} min (required: ${c.intervalMinutes} min)`);
            if (diffMin + toleranceMin < c.intervalMinutes) {
              console.log(`[Scheduler] Sender ${sender.email} gap too short - skipping`);
              triggerCtx.senderDetails[sender.email].skipped = true;
              triggerCtx.senderDetails[sender.email].skipReason = `Send gap too short (${diffMin.toFixed(1)}min < ${c.intervalMinutes}min required)`;
              continue;
            }
          }

          // ============================================================
          // PRIORITY-BASED LEAD SELECTION (sendingPriority logic)
          // sendingPriority = % of emails that should be follow-ups
          // ============================================================
          
          // Get all pending leads
          const allPendingLeads = await prisma.campaignLead.findMany({
            where: {
              campaignId: c.id,
              status: "PENDING",
              isStopped: false,
            },
            include: { lead: true },
            orderBy: { createdAt: "asc" },
          });

          if (allPendingLeads.length === 0) {
            console.log(`[Scheduler] No pending leads for campaign ${c.id}`);
            triggerCtx.senderDetails[sender.email].skipped = true;
            triggerCtx.senderDetails[sender.email].skipReason = "No pending leads available";
            continue;
          }

          // Separate into follow-up candidates and new lead candidates
          const followUpCandidates: CampaignLeadWithLead[] = [];
          const newLeadCandidates: CampaignLeadWithLead[] = [];
          const isDev = process.env.NODE_ENV === 'development';

          // Get all sequences for delay checking
          const allSequences = await prisma.sequence.findMany({
            where: { campaignId: c.id, isActive: true },
            orderBy: { seqNumber: "asc" },
          });

          for (const cl of allPendingLeads) {
            if (!cl.lead) continue;

            const nextStep = cl.currentSequenceStep + 1;
            const nextSeq = allSequences.find((s) => s.seqNumber === nextStep);
            
            if (!nextSeq) {
              // No more sequences - mark as completed
              await prisma.campaignLead.update({
                where: { id: cl.id },
                data: { status: "SENT" },
              });
              triggerCtx.activityLog.push(`Lead ${cl.lead.email} completed all sequences`);
              continue;
            }

            if (cl.currentSequenceStep === 0) {
              // New lead - hasn't received any email yet
              newLeadCandidates.push(cl);
            } else {
              // Follow-up candidate - check if delay has passed ......
              if (cl.nextSendAt && cl.nextSendAt <= new Date()) {
                followUpCandidates.push(cl);
              }
            }
          }

          console.log(`[Scheduler] sendingPriority=${c.sendingPriority}%, followUpCandidates=${followUpCandidates.length}, newLeadCandidates=${newLeadCandidates.length}`);

          // Determine which lead to send to based on sendingPriority
          // sendingPriority = % of emails for follow-ups (0-100)
          let campaignLead: CampaignLeadWithLead | null = null;
          let isNewLead = false;

          const followUpRatio = c.sendingPriority / 100;
          const currentFollowUpCount = triggerCtx.followUpEmails;
          const currentNewCount = triggerCtx.newLeadEmails;
          const totalSent = currentFollowUpCount + currentNewCount;

          // Calculate current ratio and decide what to send next
          let shouldSendFollowUp = false;
          
          if (followUpCandidates.length > 0 && newLeadCandidates.length > 0) {
            // Both available - use priority ratio
            const currentFollowUpRatio = totalSent > 0 ? currentFollowUpCount / totalSent : 0;
            shouldSendFollowUp = currentFollowUpRatio < followUpRatio;
            console.log(`[Scheduler] currentFollowUpRatio=${currentFollowUpRatio.toFixed(2)}, targetRatio=${followUpRatio}, shouldSendFollowUp=${shouldSendFollowUp}`);
          } else if (followUpCandidates.length > 0) {
            shouldSendFollowUp = true;
          } else if (newLeadCandidates.length > 0) {
            shouldSendFollowUp = false;
          } else {
            console.log(`[Scheduler] No eligible leads (follow-ups waiting for delay or no new leads)`);
            triggerCtx.senderDetails[sender.email].skipped = true;
            triggerCtx.senderDetails[sender.email].skipReason = "No eligible leads (follow-ups waiting for delay)";
            continue;
          }

          if (shouldSendFollowUp && followUpCandidates.length > 0) {
            campaignLead = followUpCandidates[0];
            isNewLead = false;
          } else if (newLeadCandidates.length > 0) {
            campaignLead = newLeadCandidates[0];
            isNewLead = true;
          } else {
            // Fallback to follow-up if no new leads
            campaignLead = followUpCandidates[0] || null;
            isNewLead = false;
          }

          if (!campaignLead || !campaignLead.lead) {
            console.log(`[Scheduler] No eligible lead found`);
            triggerCtx.senderDetails[sender.email].skipped = true;
            triggerCtx.senderDetails[sender.email].skipReason = "No eligible leads";
            continue;
          }

          const lead = campaignLead.lead;
          const nextStep = campaignLead.currentSequenceStep + 1;
          console.log(`[Scheduler] Selected lead: ${lead.email} (${lead.id}), currentStep: ${campaignLead.currentSequenceStep}, isNewLead: ${isNewLead}`);

          const sequence = allSequences.find((s) => s.seqNumber === nextStep);
          if (!sequence) {
            console.log(`[Scheduler] No sequence found for step ${nextStep} - should not happen`);
            continue;
          }
          console.log(`[Scheduler] Found sequence: step ${sequence.seqNumber}, subject: ${sequence.subject}`);

          // idempotency row first
          let sendRow;
          try {
            sendRow = await prisma.emailSend.create({
              data: {
                campaignId: c.id,
                senderId: sender.id,
                leadId: lead.id,
                status: "QUEUED",
                sequenceStep: nextStep,
                sequenceId: sequence.id,
              },
            });
            console.log(`[Scheduler] Created EmailSend row: ${sendRow.id} for sequence step ${nextStep}`);
          } catch (err) {
            console.log(`[Scheduler] EmailSend already exists for lead ${lead.id} at step ${nextStep} - skipping`);
            triggerCtx.activityLog.push(`Duplicate email skipped for ${lead.email} at step ${nextStep}`);
            continue;
          }

          // enqueue job
          await emailQueue.add("send", { emailSendId: sendRow.id });
          console.log(`[Scheduler] Enqueued job for EmailSend ${sendRow.id}`);

          // Track in trigger context
          triggerCtx.totalEmailsSent++;
          triggerCtx.senderDetails[sender.email].sent++;
          if (isNewLead) {
            triggerCtx.newLeadEmails++;
          } else {
            triggerCtx.followUpEmails++;
          }
          triggerCtx.leadDetails.push({
            leadId: lead.id,
            email: lead.email,
            sequenceStep: nextStep,
            isNewLead,
            status: "QUEUED",
          });

          // update runtime counters immediately (so next senders see updated counts)
          await prisma.senderRuntime.upsert({
            where: { senderId_dayKey: { senderId: sender.id, dayKey: dk } },
            create: { senderId: sender.id, dayKey: dk, sentToday: 1, lastSentAt: new Date() },
            update: { sentToday: { increment: 1 }, lastSentAt: new Date() },
          });
          console.log(`[Scheduler] Updated SenderRuntime for ${sender.email}`);

          await prisma.campaignRuntime.update({
            where: { campaignId: c.id },
            data: { sentToday: { increment: 1 } },
          });
          console.log(`[Scheduler] Incremented CampaignRuntime.sentToday for ${c.id}`);

          // Check if there are more sequences after this one
          const nextSequence = await prisma.sequence.findFirst({
            where: {
              campaignId: c.id,
              seqNumber: nextStep + 1,
              isActive: true,
            },
          });

          const isTestMode = process.env.NODE_ENV !== 'production';
          console.log(`[Scheduler] process.env.NODE_ENV: ${process.env.NODE_ENV}`);
          console.log(`[Scheduler] isTestMode: ${isTestMode}`);

          const delayMs = isTestMode
            ? sequence.delayDays * 60 * 60 * 1000 
            : sequence.delayDays * 24 * 60 * 60 * 1000;

          const nextSendAt = nextSequence
            ? new Date(Date.now() + delayMs)
            : null; 

          // Update campaign lead with new sequence step
          await prisma.campaignLead.update({
            where: { id: campaignLead.id },
            data: {
              currentSequenceStep: nextStep,
              lastSentAt: new Date(),
              nextSendAt: nextSendAt,
              status: nextSequence ? "PENDING" : "SENT",
            },
          });
          console.log(`[Scheduler] Updated campaign lead ${campaignLead.id}: step=${nextStep}, status=${nextSequence ? "PENDING (more steps)" : "SENT (last step)"}`);

        } finally {
          await unlockSender(sender.id, dk);
          console.log(`[Scheduler] Released lock for sender ${sender.id}`);
        }
      }

      // Determine final status and activity log
      if (triggerCtx.totalEmailsSent === 0) {
        triggerCtx.status = TriggerStatus.NO_PENDING;

        // Check why no emails were sent
        const pendingLeads = await prisma.campaignLead.count({
          where: { campaignId: c.id, status: "PENDING", isStopped: false },
        });

        if (pendingLeads === 0) {
          triggerCtx.activityLog.push("No pending leads available - all leads have completed their sequences or are stopped");
          
          await prisma.campaign.update({
            where: { id: c.id },
            data: { 
              status: CampaignStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
          console.log(`[Scheduler] ✅ Campaign ${c.id} marked as COMPLETED - all leads finished`);
          triggerCtx.activityLog.push("Campaign marked as COMPLETED");
        } else {
          triggerCtx.activityLog.push(`${pendingLeads} pending leads exist but could not be sent (check sender limits/gaps)`);
        }
      } else {
        triggerCtx.activityLog.push(`Successfully queued ${triggerCtx.totalEmailsSent} email(s): ${triggerCtx.newLeadEmails} new lead(s), ${triggerCtx.followUpEmails} follow-up(s)`);
      }

      // Save trigger log
      if (triggerCtx.totalEmailsSent > 0) {
        await saveTriggerLog(triggerCtx);
        if (triggerCtx.nextTriggerAt) {
          await prisma.campaign.update({
            where: { id: c.id },
            data: {
              nextTrigger: triggerCtx.nextTriggerAt,
            },
          });
        }
      }

    } finally {
      await unlockCampaign(c.id);
      console.log(`[Scheduler] Released lock for campaign ${c.id}`);
    }
  }
  console.log("[Scheduler] ========== TICK END ==========\n");
}
