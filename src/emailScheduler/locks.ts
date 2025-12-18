import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CAMPAIGN_LOCK_TTL_MIN = Number(process.env.CAMPAIGN_LOCK_TTL_MIN || 10);
const SENDER_LOCK_TTL_MIN = Number(process.env.SENDER_LOCK_TTL_MIN || 2);

export async function lockCampaign(campaignId: string) {
  const expiry = new Date(Date.now() - CAMPAIGN_LOCK_TTL_MIN * 60_000);

  const updated = await prisma.campaignRuntime.updateMany({
    where: {
      campaignId,
      OR: [{ lockedAt: null }, { lockedAt: { lt: expiry } }],
    },
    data: { lockedAt: new Date() },
  });

  return updated.count === 1;
}

export async function unlockCampaign(campaignId: string) {
  await prisma.campaignRuntime.updateMany({
    where: { campaignId },
    data: { lockedAt: null },
  });
}

export async function lockSender(senderId: string, dayKey: string) {
  // ensure row exists
  await prisma.senderRuntime.upsert({
    where: { senderId_dayKey: { senderId, dayKey } },
    update: {},
    create: { senderId, dayKey },
  });

  const expiry = new Date(Date.now() - SENDER_LOCK_TTL_MIN * 60_000);

  const updated = await prisma.senderRuntime.updateMany({
    where: {
      senderId,
      dayKey,
      OR: [{ lockedAt: null }, { lockedAt: { lt: expiry } }],
    },
    data: { lockedAt: new Date() },
  });

  return updated.count === 1;
}

export async function unlockSender(senderId: string, dayKey: string) {
  await prisma.senderRuntime.updateMany({
    where: { senderId, dayKey },
    data: { lockedAt: null },
  });
}