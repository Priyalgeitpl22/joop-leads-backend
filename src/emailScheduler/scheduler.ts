import { CampaignStatus, PrismaClient } from "@prisma/client";
import { emailQueue } from "./queue";
import { dayKeyInTz, isWithinSchedule } from "./time";
import { lockCampaign, unlockCampaign, lockSender, unlockSender } from "./locks";
import { TriggerContext, TriggerStatus } from "./types";

const prisma = new PrismaClient();

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

  const due = await prisma.campaignRuntime.findMany({
    where: { nextRunAt: { lte: new Date() } },
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
          if (lastSentAt) {
            const diffMin = (Date.now() - lastSentAt.getTime()) / 60_000;
            console.log(`[Scheduler] Time since last send: ${diffMin.toFixed(2)} min (required: ${c.intervalMinutes} min)`);
            if (diffMin < c.intervalMinutes) {
              console.log(`[Scheduler] Sender ${sender.email} gap too short - skipping`);
              triggerCtx.senderDetails[sender.email].skipped = true;
              triggerCtx.senderDetails[sender.email].skipReason = `Send gap too short (${diffMin.toFixed(1)}min < ${c.intervalMinutes}min required)`;
              continue;
            }
          }

          // pick ONE pending lead that is NOT stopped
          const campaignLead = await prisma.campaignLead.findFirst({
            where: {
              campaignId: c.id,
              status: "PENDING",
              isStopped: false, // Skip leads that have been stopped (replied, clicked, opened based on settings)
            },
            include: { lead: true },
            orderBy: { createdAt: "asc" },
          });
          if (!campaignLead || !campaignLead.lead) {
            console.log(`[Scheduler] No pending leads for campaign ${c.id}`);
            triggerCtx.senderDetails[sender.email].skipped = true;
            triggerCtx.senderDetails[sender.email].skipReason = "No pending leads available";
            continue;
          }
          const lead = campaignLead.lead;
          console.log(`[Scheduler] Found pending lead: ${lead.email} (${lead.id}), currentStep: ${campaignLead.currentSequenceStep}`);

          // Get the next sequence step for this lead
          const nextStep = campaignLead.currentSequenceStep + 1;
          const isNewLead = nextStep === 1;

          const sequence = await prisma.sequence.findFirst({
            where: {
              campaignId: c.id,
              seqNumber: nextStep,
              isActive: true,
            },
          });

          if (!sequence) {
            console.log(`[Scheduler] No sequence found for step ${nextStep} - lead ${lead.id} has completed all steps`);
            // Mark lead as SENT (completed all sequences)
            await prisma.campaignLead.update({
              where: { id: campaignLead.id },
              data: { status: "SENT" },
            });
            triggerCtx.activityLog.push(`Lead ${lead.email} completed all sequences`);
            continue;
          }
          console.log(`[Scheduler] Found sequence: step ${sequence.seqNumber}, subject: ${sequence.subject}`);

          // Check sequence delay (delayDays) - only for follow-up sequences (step > 1)
          // In dev environment: delayDays is treated as hours instead of days
          if (nextStep > 1 && sequence.delayDays > 0 && campaignLead.lastSentAt) {
            const isDev = process.env.NODE_ENV === 'development';
            const timeSinceLastSent = Date.now() - campaignLead.lastSentAt.getTime();
            
            let timePassed: number;
            let requiredDelay: number;
            let unit: string;
            
            if (isDev) {
              // In dev: treat delayDays as hours
              timePassed = timeSinceLastSent / (1000 * 60 * 60); // hours
              requiredDelay = sequence.delayDays; // delayDays value = hours in dev
              unit = 'hours';
            } else {
              // In production: delayDays = actual days
              timePassed = timeSinceLastSent / (1000 * 60 * 60 * 24); // days
              requiredDelay = sequence.delayDays;
              unit = 'days';
            }
            
            console.log(`[Scheduler] Sequence ${nextStep} has delay=${requiredDelay} ${unit}, timePassed=${timePassed.toFixed(2)} ${unit} (env: ${isDev ? 'dev' : 'prod'})`);
            
            if (timePassed < requiredDelay) {
              console.log(`[Scheduler] Lead ${lead.email} not ready for sequence ${nextStep} - needs ${requiredDelay} ${unit} delay, only ${timePassed.toFixed(2)} ${unit} passed`);
              triggerCtx.senderDetails[sender.email].skipped = true;
              triggerCtx.senderDetails[sender.email].skipReason = `Lead waiting for sequence delay (${timePassed.toFixed(1)}/${requiredDelay} ${unit})`;
              continue;
            }
          }

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

          // Update campaign lead with new sequence step
          await prisma.campaignLead.update({
            where: { id: campaignLead.id },
            data: {
              currentSequenceStep: nextStep,
              lastSentAt: new Date(),
              // Keep PENDING if more sequences exist, otherwise mark as SENT
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
