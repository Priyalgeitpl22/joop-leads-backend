import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { StopSending } from "../interfaces";
import { AnalyticsCountType } from "../enums";

const prisma = new PrismaClient();

async function incrementCampaignCount(campaignId: string, type: string) {
  const fieldMap: Record<string, string> = {
    openedCount: "openedCount",
    clickedCount: "clickedCount",
    repliedCount: "repliedCount",
    bouncedCount: "bouncedCount",
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
    const validTypes = ["openedCount", "clickedCount", "repliedCount", "positiveReplyCount", "bouncedCount"];

    if (!validTypes.includes(type)) {
      return { code: 400, message: `Invalid tracking type: ${type}` };
    }

    const [campaignId, email] = trackingId.split("_");

    if (type === "openedCount") {
      const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() } });

      if (lead) {
        const emailSend = await prisma.emailSend.findFirst({
          where: { campaignId, leadId: lead.id },
          orderBy: { createdAt: "desc" },
        });

        if (emailSend) {
          // Check if this email has already been opened (to only count once per email)
          const existingOpenEvent = await prisma.emailEvent.findFirst({
            where: { emailSendId: emailSend.id, type: "OPENED" },
          });

          const isFirstOpen = !existingOpenEvent;

          // Update CampaignLead status and lastOpenedAt
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId: lead.id },
            data: { 
              lastOpenedAt: new Date(),
              status: "OPENED",
            },
          });

          // Update EmailSend status (only on first open)
          if (isFirstOpen) {
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: { status: "OPENED" },
            });
          }

          // Create the event
          await prisma.emailEvent.create({
            data: { type: "OPENED", emailSendId: emailSend.id, leadId: lead.id },
          });

          // Only increment count on first open
          if (isFirstOpen) {
            await incrementCampaignCount(campaignId, AnalyticsCountType.OPENED_COUNT);
          }
        }
      }

      await stopSendingToLead(campaignId, email, "OPEN");

      const imagePath = path.join(__dirname, "../controllers/transparent.png");
      if (fs.existsSync(imagePath)) {
        return { code: 200, type: "image", imagePath };
      }
      return { code: 404, message: "Tracking image not found" };
    }

    if (type === "clickedCount" && redirect) {
      const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() } });

      if (lead) {
        const emailSend = await prisma.emailSend.findFirst({
          where: { campaignId, leadId: lead.id },
          orderBy: { createdAt: "desc" },
        });

        if (emailSend) {
          // Check if this email has already been clicked (to only count once per email)
          const existingClickEvent = await prisma.emailEvent.findFirst({
            where: { emailSendId: emailSend.id, type: "CLICKED" },
          });

          const isFirstClick = !existingClickEvent;

          // Update CampaignLead status and lastClickedAt
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId: lead.id },
            data: { 
              lastClickedAt: new Date(),
              status: "CLICKED",
            },
          });

          // Update EmailSend status (only on first click)
          if (isFirstClick) {
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: { status: "CLICKED" },
            });
          }

          // Create the event
          await prisma.emailEvent.create({
            data: { type: "CLICKED", emailSendId: emailSend.id, leadId: lead.id, linkUrl: redirect },
          });

          // Only increment count on first click
          if (isFirstClick) {
            await incrementCampaignCount(campaignId, AnalyticsCountType.CLICKED_COUNT);
          }
        }
      }

      await stopSendingToLead(campaignId, email, "CLICK");

      return { code: 302, type: "redirect", redirectUrl: redirect };
    }

    if (type === "repliedCount") {
      const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() } });

      if (lead) {
        const emailSend = await prisma.emailSend.findFirst({
          where: { campaignId, leadId: lead.id },
          orderBy: { createdAt: "desc" },
        });

        if (emailSend) {
          // Update CampaignLead status and lastRepliedAt
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId: lead.id },
            data: { 
              lastRepliedAt: new Date(),
              status: "REPLIED",
            },
          });

          // Update EmailSend status
          await prisma.emailSend.update({
            where: { id: emailSend.id },
            data: { status: "REPLIED" },
          });

          // Create the event
          await prisma.emailEvent.create({
            data: { type: "REPLIED", emailSendId: emailSend.id, leadId: lead.id },
          });
        }
      }

      await incrementCampaignCount(campaignId, AnalyticsCountType.REPLIED_COUNT);
      await stopSendingToLead(campaignId, email, "REPLY");
    }

    if (type === "bouncedCount") {
      const lead = await prisma.lead.findFirst({ where: { email: email.toLowerCase() } });

      if (lead) {
        const emailSend = await prisma.emailSend.findFirst({
          where: { campaignId, leadId: lead.id },
          orderBy: { createdAt: "desc" },
        });

        // Update CampaignLead status and stop sending
        await prisma.campaignLead.updateMany({
          where: { campaignId, leadId: lead.id },
          data: { 
            status: "BOUNCED",
            isStopped: true,
            stoppedAt: new Date(),
            stoppedReason: "BOUNCED",
          },
        });

        if (emailSend) {
          // Update EmailSend status
          await prisma.emailSend.update({
            where: { id: emailSend.id },
            data: { status: "BOUNCED" },
          });

          // Create the event
          await prisma.emailEvent.create({
            data: { type: "BOUNCED", emailSendId: emailSend.id, leadId: lead.id },
          });
        }
      }

      await incrementCampaignCount(campaignId, AnalyticsCountType.BOUNCED_COUNT);
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

