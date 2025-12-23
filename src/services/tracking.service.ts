import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { StopSending } from "../interfaces";

const prisma = new PrismaClient();

async function incrementCampaignCount(campaignId: string, type: string) {
  const fieldMap: Record<string, string> = {
    opened_count: "openedCount",
    clicked_count: "clickedCount",
    replied_count: "repliedCount",
    bounced_count: "bouncedCount",
  };

  const field = fieldMap[type];
  if (!field) return;

  await prisma.campaignAnalytics.update({
    where: { campaignId },
    data: { [field]: { increment: 1 } },
  });
}

async function pauseSameDomainLeads(campaignId: string, email: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { autoPauseSameDomain: true, orgId: true },
  });

  if (!campaign?.autoPauseSameDomain) return;

  const domain = email.toLowerCase().split("@")[1] || "";
  if (!domain) return;

  const leadsFromSameDomain = await prisma.lead.findMany({
    where: { orgId: campaign.orgId, email: { endsWith: `@${domain}` } },
    select: { id: true },
  });

  if (leadsFromSameDomain.length === 0) return;

  await prisma.campaignLead.updateMany({
    where: {
      campaignId,
      leadId: { in: leadsFromSameDomain.map((l) => l.id) },
      isStopped: false,
    },
    data: { isStopped: true, stoppedAt: new Date(), stoppedReason: "DOMAIN_REPLY" },
  });
}

async function checkBounceRateProtection(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { autoPauseOnHighBounce: true, bounceRateThreshold: true, status: true },
  });

  if (!campaign?.autoPauseOnHighBounce || campaign.status !== "ACTIVE") return;

  const analytics = await prisma.campaignAnalytics.findUnique({
    where: { campaignId },
    select: { sentCount: true, bouncedCount: true },
  });

  if (!analytics || analytics.sentCount < 10) return;

  const bounceRate = (analytics.bouncedCount / analytics.sentCount) * 100;

  if (bounceRate >= campaign.bounceRateThreshold) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  }
}

async function stopSendingToLead(campaignId: string, email: string, reason: StopSending): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { stopSending: true, autoPauseSameDomain: true },
  });

  if (!campaign) return;

  const shouldStop =
    (reason === "REPLY" && campaign.stopSending === "REPLY") ||
    (reason === "CLICK" && campaign.stopSending === "CLICK") ||
    (reason === "OPEN" && campaign.stopSending === "OPEN");

  if (!shouldStop) return;

  const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (!lead) return;

  const campaignLead = await prisma.campaignLead.findFirst({ where: { campaignId, leadId: lead.id } });
  if (!campaignLead) return;

  await prisma.campaignLead.update({
    where: { id: campaignLead.id },
    data: { isStopped: true, stoppedAt: new Date(), stoppedReason: reason },
  });

  if (reason === "REPLY" && campaign.autoPauseSameDomain) {
    await pauseSameDomainLeads(campaignId, email);
  }
}

export class TrackingService {
  static async trackEvent(trackingId: string, type: string, redirect?: string) {
    const validTypes = ["opened_count", "clicked_count", "replied_count", "positive_reply_count", "bounced_count"];

    if (!validTypes.includes(type)) {
      return { code: 400, message: `Invalid tracking type: ${type}` };
    }

    const [campaignId, email] = trackingId.split("_");

    if (type === "opened_count") {
      const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() } });

      if (lead) {
        const emailSend = await prisma.emailSend.findFirst({
          where: { campaignId, leadId: lead.id },
          orderBy: { createdAt: "desc" },
        });

        if (emailSend) {
          await prisma.emailEvent.create({
            data: { type: "OPENED", emailSendId: emailSend.id, leadId: lead.id },
          });
        }
      }

      await incrementCampaignCount(campaignId, "opened_count");
      await stopSendingToLead(campaignId, email, "OPEN");

      const imagePath = path.join(__dirname, "../controllers/transparent.png");
      if (fs.existsSync(imagePath)) {
        return { code: 200, type: "image", imagePath };
      }
      return { code: 404, message: "Tracking image not found" };
    }

    if (type === "clicked_count" && redirect) {
      const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() } });

      if (lead) {
        const emailSend = await prisma.emailSend.findFirst({
          where: { campaignId, leadId: lead.id },
          orderBy: { createdAt: "desc" },
        });

        if (emailSend) {
          await prisma.emailEvent.create({
            data: { type: "CLICKED", emailSendId: emailSend.id, leadId: lead.id, linkUrl: redirect },
          });
        }
      }

      await incrementCampaignCount(campaignId, "clicked_count");
      await stopSendingToLead(campaignId, email, "CLICK");

      return { code: 302, type: "redirect", redirectUrl: redirect };
    }

    if (type === "replied_count") {
      const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() } });

      if (lead) {
        const emailSend = await prisma.emailSend.findFirst({
          where: { campaignId, leadId: lead.id },
          orderBy: { createdAt: "desc" },
        });

        if (emailSend) {
          await prisma.emailEvent.create({
            data: { type: "REPLIED", emailSendId: emailSend.id, leadId: lead.id },
          });
        }
      }

      await incrementCampaignCount(campaignId, "replied_count");
      await stopSendingToLead(campaignId, email, "REPLY");
    }

    if (type === "bounced_count") {
      await incrementCampaignCount(campaignId, "bounced_count");
      await checkBounceRateProtection(campaignId);
    }

    return { code: 200, message: `${type} updated for ${email}` };
  }

  static async getAllThreadsFromEmail(email: string) {
    if (!email) return { code: 404, message: "Email id not found" };

    const senderAccount = await prisma.senderAccount.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!senderAccount) {
      return { code: 404, message: "Sender account not found" };
    }

    const data = await prisma.emailSend.findMany({
      where: { senderId: senderAccount.id },
      select: { threadId: true },
    });

    const threads = data.map((elem) => elem.threadId).filter((id) => id !== null);
    return { code: 200, data: threads, message: "Data found successfully" };
  }
}

