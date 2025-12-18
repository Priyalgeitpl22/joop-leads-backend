import { CampaignStatus, PrismaClient } from "@prisma/client";
import { emailQueue } from "./queue";
import { dayKeyInTz, isWithinSchedule } from "./time";
import { lockCampaign, unlockCampaign, lockSender, unlockSender } from "./locks";

const prisma = new PrismaClient();

/**
 * Run this every 1 minute via cron/pm2. It will internally respect campaign intervalMinutes.
 */
export async function schedulerTick() {
  const due = await prisma.campaignRuntime.findMany({
    where: { nextRunAt: { lte: new Date() } },
    include: { campaign: true },
  });

  for (const rt of due) {
    const c = rt.campaign;
    const isActive = c?.status === CampaignStatus.ACTIVE;
    if (!isActive) continue;

    const gotLock = await lockCampaign(c.id);
    if (!gotLock) continue;

    try {
      const tz = c.timezone;
      const dk = dayKeyInTz(tz);

      // reset daily counters if day changed
      if (rt.dayKey !== dk) {
        await prisma.campaignRuntime.update({
          where: { campaignId: c.id },
          data: { dayKey: dk, sentToday: 0 },
        });
      }

      // Always push nextRunAt forward first (crash-safe)
      await prisma.campaignRuntime.update({
        where: { campaignId: c.id },
        data: { nextRunAt: new Date(Date.now() + c.intervalMinutes * 60_000) },
      });

      // (3)(4) schedule/day/time/timezone gate
      if (!isWithinSchedule({
        timezone: tz,
        sendDays: c.sendDays,
        windowStart: c.windowStart,
        windowEnd: c.windowEnd,
      })) {
        continue;
      }

      // (1) campaign max/day gate
      const freshRt = await prisma.campaignRuntime.findUnique({ where: { campaignId: c.id } });
      if (!freshRt) continue;
      if (freshRt.sentToday >= c.maxEmailsPerDay) continue;

      // load senders
      const senders = await prisma.senderAccount.findMany({
        where: { isEnabled: true },
      });

      // For each sender: enqueue max 1 email per run (Smartlead pattern)
      for (const sender of senders) {
        // Stop if campaign reached max/day during this loop
        const current = await prisma.campaignRuntime.findUnique({ where: { campaignId: c.id } });
        if (!current || current.sentToday >= c.maxEmailsPerDay) break;

        const senderLocked = await lockSender(sender.id, dk);
        if (!senderLocked) continue;

        try {
          const srt = await prisma.senderRuntime.findUnique({
            where: { senderId_dayKey: { senderId: sender.id, dayKey: dk } },
          });

          const sentToday = srt?.sentToday ?? 0;
          const lastSentAt = srt?.lastSentAt ?? null;

          // (5) sender daily limit gate
          if (sentToday >= sender.dailyLimit) continue;

          // (6) sender gap must be >= campaign intervalMinutes
          if (lastSentAt) {
            const diffMin = (Date.now() - lastSentAt.getTime()) / 60_000;
            if (diffMin < c.intervalMinutes) continue;
          }

          // pick ONE pending lead
          const lead = await prisma.lead.findFirst({
            where: { campaignId: c.id, status: "PENDING" },
            orderBy: { createdAt: "asc" },
          });
          if (!lead) continue;

          // idempotency row first
          let sendRow;
          try {
            sendRow = await prisma.emailSend.create({
              data: { campaignId: c.id, senderId: sender.id, leadId: lead.id, status: "QUEUED" },
            });
          } catch {
            // lead already queued/sent for this campaign
            continue;
          }

          // enqueue job
          await emailQueue.add("send", { emailSendId: sendRow.id });

          // update runtime counters immediately (so next senders see updated counts)
          await prisma.senderRuntime.update({
            where: { senderId_dayKey: { senderId: sender.id, dayKey: dk } },
            data: { sentToday: { increment: 1 }, lastSentAt: new Date() },
          });

          await prisma.campaignRuntime.update({
            where: { campaignId: c.id },
            data: { sentToday: { increment: 1 } },
          });

          // mark lead as "SENT" (or keep as PENDING until worker success if you want)
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "SENT" },
          });

        } finally {
          await unlockSender(sender.id, dk);
        }
      }
    } finally {
      await unlockCampaign(c.id);
    }
  }
}