import { Request } from "express";
import { CampaignStatus, PrismaClient } from "@prisma/client";
import { Readable } from "stream";
import csv from "csv-parser";
import multer from "multer";
import { isValidEmail } from "../utils/email.utils";
import { uploadCSVToS3, getPresignedUrl } from "../aws/imageUtils";
import { subDays, format } from "date-fns";
import { SenderAccountService } from "./sender.account.service";
import { dayKeyInTz } from "../emailScheduler/time";
import { SequenceAnalytics } from "../emailScheduler/types";
import { CampaignSenderWithStats } from "../interfaces";
import { getUsageAndLimits, incrementLeadsAdded } from "./organization.usage.service";
import { checkForLeadsAddedThisPeriod } from "../middlewares/enforcePlanLimits";
import { formatReplyText } from "../utils/reply.utils";

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const zonedTimeToUtc = (dateStr: string, tz: string): Date => {
  return dayjs.tz(dateStr, tz).utc().toDate();
};
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() }).single("csvFile");
export class CampaignService {
  static addLeadsToCampaign = (req: Request): Promise<any> =>
    new Promise((resolve, reject) => {
      upload(req, req.res!, async (err) => {
        if (err) return reject({ code: 500, message: "File upload failed", error: err.message });

        try {
          const user = req.user!;
          if (!req.file) return resolve({ code: 400, message: "No file uploaded" });
          if (!req.body.emailFieldsToBeAdded) return resolve({ code: 400, message: "emailFieldsToBeAdded is required" });

          const csvFileName = req.file.originalname;

          const campaignId = req.body.campaignId ? String(req.body.campaignId) : null;
          let campaign = campaignId
            ? await prisma.campaign.findUnique({ where: { id: campaignId } })
            : await prisma.campaign.create({ data: { orgId: user.orgId, name: "Untitled Campaign", status: "DRAFT", csvFileName: csvFileName } });

          if (campaignId && !campaign) return resolve({ code: 404, message: "Campaign not found" });

          await prisma.campaignAnalytics.upsert({
            where: { campaignId: campaign!.id },
            update: {},
            create: { campaignId: campaign!.id },
          });

          const csvUploded = await uploadCSVToS3(campaign!.id, req.file);

          if (!csvUploded) {
            resolve({ code: 500, message: "Failed to upload csv file." });
          } else {
            await prisma.campaign.update({
              where: { id: campaign!.id },
              data: { csvFile: csvUploded },
            });
          }

          const csvSettings = typeof req.body.CSVsettings === "string" ? JSON.parse(req.body.CSVsettings) : req.body.CSVsettings || {};
          const emailFieldsToBeAdded = typeof req.body.emailFieldsToBeAdded === "string"
            ? JSON.parse(req.body.emailFieldsToBeAdded)
            : req.body.emailFieldsToBeAdded;

          const results: any[] = [];
          const stream = Readable.from(req.file.buffer).pipe(csv());

          stream.on("data", (data) => {
            const jsonData: Record<string, any> = {};
            Object.entries(emailFieldsToBeAdded).forEach(([csvKey, mappedKey]) => {
              if (typeof mappedKey === "string" && mappedKey !== "ignore_field") {
                const actualKey = Object.keys(data).find((k) => k.trim().toLowerCase() === csvKey.trim().toLowerCase());
                if (actualKey) jsonData[mappedKey] = data[actualKey]?.trim() || "";
              }
            });
            results.push(jsonData);
          });

          stream.on("end", async () => {
            try {
              let duplicateCount = 0, blockedCount = 0, emptyCount = 0, invalidCount = 0, unsubscribedCount = 0, skippedOtherCampaignCount = 0;
              const campaignLeadRecords: { leadId: string; campaignId: string }[] = [];
              const newLeads: any[] = [];

              const emails = results.map((r) => r.email?.toLowerCase().trim()).filter(Boolean);
              const existingLeads = await prisma.lead.findMany({ where: { email: { in: emails }, orgId: user.orgId } });
              const existingLeadMap = new Map(existingLeads.map((l) => [l.email.toLowerCase(), l]));

              for (const lead of results) {
                const email = lead.email?.toLowerCase().trim();
                if (!email) { emptyCount++; continue; }
                if (!isValidEmail(email)) { invalidCount++; continue; }

                const existing = existingLeadMap.get(email);
                if (existing) {
                  if (existing.isBlocked) { blockedCount++; continue; }
                  if (existing.isUnsubscribed) { unsubscribedCount++; continue; }

                  const existingCampaignLead = await prisma.campaignLead.findFirst({ where: { leadId: existing.id, campaignId: campaign!.id } });
                  if (existingCampaignLead) { duplicateCount++; continue; }

                  if (csvSettings.ignoreDuplicateLeadsInOtherCampaign === "true") {
                    const otherCampaign = await prisma.campaignLead.findFirst({ where: { leadId: existing.id } });
                    if (otherCampaign) { skippedOtherCampaignCount++; continue; }
                  }

                  campaignLeadRecords.push({ leadId: existing.id, campaignId: campaign!.id });
                  continue;
                }

                newLeads.push({ ...lead, email, orgId: user.orgId, uploadedById: user.id, source: "csv_upload", fileName: csvFileName });
              }

              if (newLeads.length > 0) {
                const checkResult = await checkForLeadsAddedThisPeriod(newLeads.length, user.orgId);
                if (checkResult && checkResult.code !== 200) {
                  resolve(checkResult);
                  return;
                }
              }

              if (newLeads.length > 0) await prisma.lead.createMany({ data: newLeads, skipDuplicates: true });
              const insertedLeads = await prisma.lead.findMany({ where: { email: { in: newLeads.map((l) => l.email) }, orgId: user.orgId } });
              insertedLeads.forEach((l) => campaignLeadRecords.push({ leadId: l.id, campaignId: campaign!.id }));

              if (insertedLeads.length > 0) {
                incrementLeadsAdded(user.orgId, insertedLeads.length).catch((err) =>
                  console.error("[CampaignService] Failed to increment leads usage:", err)
                );
              }

              if (campaignLeadRecords.length > 0) await prisma.campaignLead.createMany({ data: campaignLeadRecords, skipDuplicates: true });
              const newCampaign = await prisma.campaign.findUnique({ where: { id: campaign!.id }, include: { sequences: true, analytics: true, leads: { include: { lead: true } }, senders: { include: { sender: true } } } });

              resolve({
                code: 200,
                message: campaignId ? "Campaign updated successfully" : "File uploaded and leads saved successfully",
                data: {
                  campaign: newCampaign,
                  counts: { uploaded: campaignLeadRecords.length, duplicates: duplicateCount, blocked: blockedCount, empty: emptyCount, invalid: invalidCount, unsubscribed: unsubscribedCount, skippedOtherCampaign: skippedOtherCampaignCount }
                },
              });
            } catch (dbError: any) {
              resolve({ code: 500, message: "Database error while saving leads", error: dbError.message });
            }
          });

          stream.on("error", (error) => resolve({ code: 500, message: "Error parsing CSV file", error: error.message }));
        } catch (err: any) {
          resolve({ code: 500, message: "Internal server error", error: err.message });
        }
      });
    });

  static async addSequenceToCampaign(req: Request) {
    const { campaignId, sequences } = req.body;

    if (!campaignId) return { code: 400, message: "Campaign ID is required" };

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { code: 404, message: `Campaign with ID ${campaignId} not found` };

    if (!sequences || sequences.length === 0) return { code: 400, message: "At least one sequence is required" };

    await prisma.$transaction(async (tx) => {
      await tx.sequence.deleteMany({ where: { campaignId: campaignId } });

      for (let i = 0; i < sequences.length; i++) {
        const seq = sequences[i];
        await tx.sequence.create({
          data: {
            campaignId: campaignId,
            seqNumber: seq.seqNumber,
            type: seq.type,
            delayDays: seq.delayDays,
            delayHours: seq.delayHours,
            delayMinutes: seq.delayMinutes,
            subject: seq.subject,
            bodyText: seq.bodyText,
            bodyHtml: seq.bodyHtml,
            taskTitle: seq.taskTitle,
            taskDescription: seq.taskDescription,
          },
        });
      }
    });

    return { code: 200, data: { campaignId }, message: "Sequence details saved successfully" };
  }

  static async addEmailCampaignSettings(req: Request) {
    try {
      const { campaign_id, sender_accounts, name, timezone, sendDays, windowStart, windowEnd, nextTrigger, scheduledAt, intervalMinutes, maxEmailsPerDay, sendAsPlainText, trackOpens, trackClicks, stopSending, sendingPriority, autoPauseSameDomain, bounceRateThreshold, autoPauseOnHighBounce, includeUnsubscribeLink, unsubscribeText } = req.body;

      if (!campaign_id) return { code: 400, message: "Campaign ID is required" };

      const campaign = await prisma.campaign.findUnique({ where: { id: campaign_id } });
      if (!campaign) return { code: 404, message: `Campaign with ID ${campaign_id} not found` };

      const scheduledAtUtc = scheduledAt
        ? zonedTimeToUtc(scheduledAt, timezone)
        : null;

      const nextTriggerUtc = nextTrigger
        ? zonedTimeToUtc(nextTrigger, timezone)
        : null;

      await prisma.$transaction(async (tx) => {
        await tx.campaign.update({
          where: { id: campaign_id },
          data: {
            name: name || campaign.name,
            timezone: timezone || campaign.timezone,
            sendDays: sendDays || campaign.sendDays,
            windowStart: windowStart || campaign.windowStart,
            windowEnd: windowEnd || campaign.windowEnd,
            scheduledAt: scheduledAtUtc || campaign.scheduledAt,
            nextTrigger: nextTriggerUtc || campaign.nextTrigger,
            intervalMinutes: intervalMinutes || campaign.intervalMinutes,
            maxEmailsPerDay: maxEmailsPerDay || campaign.maxEmailsPerDay,
            stopSending: stopSending || campaign.stopSending,
            trackOpens: trackOpens ?? campaign.trackOpens,
            trackClicks: trackClicks ?? campaign.trackClicks,
            sendAsPlainText: sendAsPlainText ?? campaign.sendAsPlainText,
            sendingPriority: sendingPriority || campaign.sendingPriority,
            autoPauseSameDomain: autoPauseSameDomain ?? campaign.autoPauseSameDomain,
            bounceRateThreshold: bounceRateThreshold ?? campaign.bounceRateThreshold,
            autoPauseOnHighBounce: autoPauseOnHighBounce ?? campaign.autoPauseOnHighBounce,
            includeUnsubscribeLink: includeUnsubscribeLink ?? campaign.includeUnsubscribeLink,
            unsubscribeText: unsubscribeText ?? campaign.unsubscribeText,
          },
        });

        // Update sender accounts
        if (sender_accounts && sender_accounts.length > 0) {
          await tx.campaignSender.deleteMany({ where: { campaignId: campaign_id } });
          for (const account of sender_accounts) {

            const senderAccount = await SenderAccountService.getSenderAccount(account.account_id, account.email);

            if (!senderAccount) {
              const newSenderAccount = await SenderAccountService.createSenderAccount(account);
              if (!newSenderAccount) {
                continue;
              }
              await tx.campaignSender.create({
                data: {
                  campaignId: campaign_id,
                  senderId: newSenderAccount.id,
                  weight: account.weight || 1,
                },
              });
            } else {
              await tx.campaignSender.create({
                data: {
                  campaignId: campaign_id,
                  senderId: senderAccount.id,
                  weight: account.weight || 1,
                },
              });
            }
          }
        }

      });

      return { code: 200, message: "Campaign settings saved successfully" };
    } catch (error) {
      console.error(error);
      return { code: 500, message: "Internal server error" };
    }
  }

  static async getAllEmailCampaigns(req: Request) {
    const user = req.user!;
    const campaignId = req.query.campaign_id ? String(req.query.campaign_id) : undefined;

    if (campaignId) {
      const data = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { sequences: true, analytics: true, leads: { include: { lead: true } }, senders: { include: { sender: true } } },
      });
      return { code: 200, data, message: "success" };
    }

    const campaigns = await prisma.campaign.findMany({
      where: { orgId: user.orgId },
      include: { sequences: true, analytics: true, leads: { include: { lead: true } }, senders: true },
      orderBy: { createdAt: "desc" },
    });

    const data = campaigns.map((c) => {
      const totalEmailsNeeded = c.leads.length * c.sequences.length;
      const totalSent = c.analytics?.sentCount || 0;
      const completedPercentage = calculateCampaignCompletionPercentage(c);

      return {
        total_leads: c.leads.length,
        total_sequences: c.sequences.length,
        total_emails_needed: c.leads.length * c.sequences.length,
        completedPercentage: completedPercentage,
        ...c,
        sequence_count: c.sequences.length,
        contact_count: c.leads.length,
        analytics_count: c.analytics,
        contacts: c.leads.map((cl) => cl.lead),
      };
    });

    return { code: 200, data, message: "success" };
  }

  static async getCampaignById(req: Request) {
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        sequences: { orderBy: { seqNumber: "asc" } },
        analytics: true,
        leads: { include: { lead: true } },
        senders: { include: { sender: true } },
        emailSends: true
      },
    });

    if (!campaign) return { code: 404, message: "Campaign not found" };

    const campaignLeads = await this.getCampaignLeads(campaign.id);
    const campaignStats = await this.getCampaignStats(campaign.id);

    const totalEmailsNeeded = campaign.leads.length * campaign.sequences.length;
    const totalSent = campaign.analytics?.sentCount || 0;
    const totalProcessed = totalSent + (campaign.analytics?.repliedCount || 0) + (campaign.analytics?.openedCount || 0) + (campaign.analytics?.clickedCount || 0) + (campaign.analytics?.unsubscribedCount || 0) + (campaign.analytics?.failedCount || 0);
    const completedPercentage = totalEmailsNeeded > 0
      ? parseFloat(((totalSent / totalEmailsNeeded) * 100).toFixed(2))
      : 0;

    if (campaign.csvFile) {
      const csvFile = await getPresignedUrl(campaign.csvFile);
      campaign.csvFile = csvFile;
    }

    return {
      code: 200,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        scheduledAt: campaign.scheduledAt,
        startedAt: campaign.startedAt,
        windowStart: campaign.windowStart,
        windowEnd: campaign.windowEnd,
        sendDays: campaign.sendDays,
        intervalMinutes: campaign.intervalMinutes,
        maxEmailsPerDay: campaign.maxEmailsPerDay,
        stopSending: campaign.stopSending,
        nextTrigger: campaign.nextTrigger,
        trackOpens: campaign.trackOpens,
        stoppedAt: campaign.stoppedAt,
        stoppedReason: campaign.stoppedReason,
        stoppedDetails: campaign.stoppedDetails,
        trackClicks: campaign.trackClicks,
        timezone: campaign.timezone,
        sendAsPlainText: campaign.sendAsPlainText,
        includeUnsubscribeLink: campaign.includeUnsubscribeLink,
        unsubscribeText: campaign.unsubscribeText,
        autoPauseSameDomain: campaign.autoPauseSameDomain,
        bounceRateThreshold: campaign.bounceRateThreshold,
        autoPauseOnHighBounce: campaign.autoPauseOnHighBounce,
        completedPercentage: completedPercentage,
        completedAt: campaign.completedAt,
        sendingPriority: campaign.sendingPriority,
        createdAt: campaign.createdAt,
        leads: campaign.leads.map((cl) => cl.lead),
        campaignLeads,
        sequences: campaign.sequences,
        sender_accounts: campaign.senders.map((s) => s.sender),
        analytics: campaign.analytics,
        campaignStats,
        csvFile: campaign.csvFile,
        csvFileName: campaign.csvFileName,
      },
      message: "success",
    };
  }

  static async getSenderAccounts(campaignId: string) {
    const senders = await prisma.campaignSender.findMany({ where: { campaignId }, include: { sender: true } });
    return senders;
  }

  static async getAllSequences(req: Request) {
    const campaignId = req.params.campaign_id;
    const sequenceId = req.query.sequence_id ? String(req.query.sequence_id) : undefined;

    if (sequenceId) {
      const data = await prisma.sequence.findUnique({ where: { id: sequenceId } });
      if (!data) return { code: 404, message: "Sequence not found" };
      return { code: 200, data, message: "Success" };
    }

    const data = await prisma.sequence.findMany({
      where: { campaignId },
      orderBy: { seqNumber: "asc" },
    });

    return { code: 200, data, total: data.length, message: data.length ? "Success" : "No sequences found" };
  }

  static async getCampaignSequences(campaignId: string) {
    const sequences = await prisma.sequence.findMany({ where: { campaignId }, orderBy: { seqNumber: "asc" }, include: { emailSends: true } });
    return sequences;
  }

  static async getCampaignsByLeadId(leadId: string) {
    const campaigns = await prisma.campaignLead.findMany({ where: { leadId }, include: { campaign: { include: { sequences: true, analytics: true, leads: { include: { lead: true } }, senders: { include: { sender: true } } } } } });
    console.log(campaigns);
    return campaigns.map((cl) => {
      return {
        id: cl.campaign.id,
        name: cl.campaign.name,
        totalSteps: cl.campaign.sequences.length,
        currentSequenceStep: cl.currentSequenceStep,
        createdAt: cl.campaign.createdAt,
        status: cl.campaign.status,
        lastSentAt: cl.lastSentAt,
        lastOpenedAt: cl.lastOpenedAt,
        lastClickedAt: cl.lastClickedAt,
        lastRepliedAt: cl.lastRepliedAt,
      }
    });
  }

  static async getCampaignSenders(campaignId: string): Promise<CampaignSenderWithStats[]> {
    const campaignSenders = await prisma.campaignSender.findMany({
      where: { campaignId },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
            provider: true,
            dailyLimit: true,
            isEnabled: true,
            accountId: true,
          },
        },
      },
    });

    const sendersWithStats = await Promise.all(
      campaignSenders.map(async (cs) => {
        const emailsSent = await prisma.emailSend.count({
          where: {
            campaignId,
            senderId: cs.senderId,
            status: "SENT",
          },
        });

        const emailsQueued = await prisma.emailSend.count({
          where: {
            campaignId,
            senderId: cs.senderId,
            status: "QUEUED",
          },
        });

        const emailsFailed = await prisma.emailSend.count({
          where: {
            campaignId,
            senderId: cs.senderId,
            status: "FAILED",
          },
        });

        // Count unique leads that received emails from this sender
        const uniqueLeadsResult = await prisma.emailSend.findMany({
          where: {
            campaignId,
            senderId: cs.senderId,
          },
          select: {
            leadId: true,
          },
          distinct: ["leadId"],
        });
        const uniqueLeads = uniqueLeadsResult.length;

        return {
          id: cs.id,
          senderId: cs.senderId,
          accountId: cs.sender.accountId,
          email: cs.sender.email,
          name: cs.sender.name,
          provider: cs.sender.provider,
          dailyLimit: cs.sender.dailyLimit,
          isEnabled: cs.sender.isEnabled,
          isActive: cs.isActive,
          weight: cs.weight,
          stats: {
            sent: emailsSent,
            queued: emailsQueued,
            failed: emailsFailed,
            total: emailsSent + emailsQueued + emailsFailed,
            uniqueLeads,
          },
        };
      })
    );

    return sendersWithStats;
  }

  static async getAllContacts(req: Request) {
    const campaignId = req.params.campaign_id;

    const campaignLeads = await prisma.campaignLead.findMany({
      where: { campaignId },
      include: { lead: true },
    });

    if (!campaignLeads.length) return { code: 404, message: "No contacts found" };

    const contacts = campaignLeads.map((cl) => cl.lead);
    return { code: 200, data: contacts, total: contacts.length, message: "Success" };
  }

  static async searchEmailCampaigns(req: Request) {
    const user = req.user!;
    const query = req.query.q as string;

    if (!query) return { code: 400, message: "Query is required" };

    const campaigns = await prisma.campaign.findMany({
      where: { name: { contains: query, mode: "insensitive" }, orgId: user.orgId },
      include: { sequences: true, analytics: true, leads: { include: { lead: true } } },
    });

    const data = campaigns.map((c) => ({
      ...c,
      analytics_count: c.analytics,
      contact_count: c.leads.length,
      contacts: c.leads.map((cl) => cl.lead),
    }));

    return { code: 200, data, message: data.length ? "Success" : "No campaigns found" };
  }

  static async scheduleEmailCampaign(req: Request) {
    const { campaignId, status } = req.body;

    if (!campaignId || !status) return { code: 400, message: "campaignId and status are required" };

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status },
    });

    return { code: 200, data: updatedCampaign, message: "success" };
  }

  static async updateCampaignStatus(req: Request) {
    const { campaignId, status } = req.body;

    if (!campaignId || !status) return { code: 400, message: "campaignId and status are required" };

    const existingCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!existingCampaign) return { code: 404, message: "Campaign not found" };

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status },
    });

    if (status === "SCHEDULED") {
      await this.createCampaignRuntime(campaignId);
    }

    return { code: 200, data: updatedCampaign, message: "Campaign status updated successfully" };
  }

  private static async createCampaignRuntime(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    const tz = campaign.timezone || "UTC";
    const dayKey = dayKeyInTz(tz);

    // Determine nextRunAt:
    // - If scheduledAt is set and in the future, use that
    // - Otherwise, run immediately on next scheduler tick
    let nextRunAt = new Date();

    if (campaign.scheduledAt) {
      const scheduledTimeUtc = dayjs
        .tz(campaign.scheduledAt, tz)
        .utc()
        .toDate();

      if (scheduledTimeUtc > new Date()) {
        nextRunAt = scheduledTimeUtc;
      }
    }

    await prisma.campaignRuntime.upsert({
      where: { campaignId },
      create: {
        campaignId,
        dayKey,
        sentToday: 0,
        nextRunAt,
      },
      update: {
        // On resume/reactivation, reset nextRunAt to start again
        nextRunAt,
      },
    });
  }

  static async deleteCampaign(req: Request) {
    const campaignId = req.params.id as string;

    if (!campaignId) return { code: 400, message: "campaignId is required" };

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { code: 404, message: "Campaign not found" };

    await prisma.campaign.delete({ where: { id: campaignId } });

    return { code: 200, message: "Campaign deleted successfully" };
  }

  static async filterEmailCampaigns(req: Request) {
    const user = req.user!;
    const { status, startDate, endDate } = req.query;

    const filters: any = { orgId: user.orgId };

    if (status) filters.status = status as string;

    if (startDate) {
      const parsedStartDate = new Date(startDate as string);
      if (isNaN(parsedStartDate.getTime())) return { code: 400, message: "Invalid start date format." };
      filters.createdAt = { ...filters.createdAt, gte: parsedStartDate };
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate as string);
      if (isNaN(parsedEndDate.getTime())) return { code: 400, message: "Invalid end date format." };
      filters.createdAt = { ...filters.createdAt, lte: parsedEndDate };
    }

    const campaigns = await prisma.campaign.findMany({
      where: filters,
      include: { sequences: true, analytics: true },
    });

    const data = campaigns.map((c) => ({
      ...c,
      analytics_count: c.analytics,
    }));

    return { code: 200, data, message: data.length ? "Success" : "No campaigns found" };
  }

  static async renameCampaign(req: Request) {
    const { newName } = req.body;
    const { campaign_id } = req.params;

    if (!newName) return { code: 400, message: "Invalid input or missing" };

    const existingCampaign = await prisma.campaign.findUnique({ where: { id: campaign_id } });
    if (!existingCampaign) return { code: 404, message: `Campaign with the specified Id:${campaign_id} does not exist` };

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign_id },
      data: { name: newName },
    });

    return { code: 200, data: updatedCampaign, message: "Campaign renamed successfully" };
  }

  static async getDashboardData(req: Request) {
    const user = req.user!;

    const [totalLeads, analytics, activeCampaigns, completedCampaigns, draftCampaigns, scheduledCampaigns, pausedCampaigns] = await Promise.all([
      prisma.lead.count({ where: { orgId: user.orgId } }),
      prisma.campaignAnalytics.findMany({ where: { campaign: { orgId: user.orgId } } }),
      prisma.campaign.count({ where: { orgId: user.orgId, status: "ACTIVE" } }),
      prisma.campaign.count({ where: { orgId: user.orgId, status: "COMPLETED" } }),
      prisma.campaign.count({ where: { orgId: user.orgId, status: "DRAFT" } }),
      prisma.campaign.count({ where: { orgId: user.orgId, status: "SCHEDULED" } }),
      prisma.campaign.count({ where: { orgId: user.orgId, status: "PAUSED" } }),
    ]);

    const totalSentCount = analytics.reduce((sum, a) => sum + a.sentCount, 0);
    const totalBouncedCount = analytics.reduce((sum, a) => sum + a.bouncedCount, 0);

    const today = new Date();
    const past7Days = Array.from({ length: 7 }).map((_, i) => format(subDays(today, 6 - i), "yyyy-MM-dd"));

    const graphDataRaw = await prisma.campaignAnalytics.findMany({
      where: { campaign: { orgId: user.orgId }, createdAt: { gte: subDays(today, 6) } },
      select: { sentCount: true, createdAt: true },
    });

    const graphMap: Record<string, number> = {};
    graphDataRaw.forEach((entry) => {
      const day = format(new Date(entry.createdAt), "yyyy-MM-dd");
      graphMap[day] = (graphMap[day] || 0) + entry.sentCount;
    });

    const graphData = past7Days.map((date, i) => ({
      date,
      today: graphMap[date] || 0,
      yesterday: i > 0 ? graphMap[past7Days[i - 1]] || 0 : 0,
    }));

    return {
      code: 200,
      message: "Dashboard data fetched successfully",
      data: {
        total_leads: totalLeads,
        total_sent_count: totalSentCount,
        total_bounced_count: totalBouncedCount,
        total_active_campaigns: activeCampaigns,
        total_completed_campaigns: completedCampaigns,
        total_drafted_campaigns: draftCampaigns,
        total_scheduled_campaigns: scheduledCampaigns,
        total_paused_campaigns: pausedCampaigns,
        graph_data: graphData,
      },
    };
  }

  static async getNextTrigger(req: Request) {
    const campaignId = req.params.campaign_id;

    if (!campaignId) return { code: 400, message: "campaign_id is required" };

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { code: 404, message: "Campaign not found" };

    return { code: 200, data: campaign.nextTrigger, message: "success" };
  }

  static async getCampaignLeads(campaignId: string) {
    const campaignLeads = await prisma.campaignLead.findMany({ where: { campaignId }, include: { lead: true } });
    if (!campaignLeads) return [];
    return campaignLeads;
  }

  static async getLeadsGroupedBySender(campaignId: string, filters: any) {
    
    const whereClause: any = { campaignId };
    if (filters?.status) whereClause.status = filters?.status;
    if (filters?.sequenceStep) whereClause.currentSequenceStep = filters?.sequenceStep;

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { code: 404, message: "Campaign not found" };

    if (campaign.status === CampaignStatus.DRAFT) {
      const campaignLeads = await prisma.campaignLead.findMany({
        where: whereClause,
        include: { lead: true },
      });
      const totalSequences = await prisma.sequence.count({
        where: { campaignId, isActive: true },
      });
      const groupedLeads = campaignLeads.map((cl) => ({
        lead: cl.lead,
        currentSequenceStep: null,
        lastSentAt: null,
        leadStatus: cl.status,
        senders: [],
        totalSequences,
      }));
      return { groupedLeads, totalSequences };
    }

    const [campaignLeads, sends, totalSequences] = await Promise.all([
      prisma.campaignLead.findMany({
        where: whereClause,
        include: { lead: true },
      }),
      prisma.emailSend.findMany({
        where: { campaignId },
        include: { lead: true, sender: true },
      }),
      prisma.sequence.count({ where: { campaignId, isActive: true } }),
    ]);

    // Group sends by leadId (unique sender per lead by sender email)
    const sendsByLeadId = sends.reduce((acc, send) => {
      const leadId = send.lead.id;
      if (!acc[leadId]) acc[leadId] = [];
      const existing = acc[leadId].find((s) => s.senderEmail === send.sender.email);
      if (!existing) {
        acc[leadId].push({
          senderEmail: send.sender.email,
          status: send.status,
          sentAt: send.sentAt,
        });
      }
      return acc;
    }, {} as Record<string, { senderEmail: string; status: string; sentAt: Date | null }[]>);

    const groupedLeads = campaignLeads.map((cl) => ({
      lead: cl.lead,
      currentSequenceStep: cl.currentSequenceStep ?? 0,
      totalSequences,
      leadStatus: cl.status,
      lastSentAt: cl.lastSentAt,
      senders: sendsByLeadId[cl.leadId] ?? [],
    }));

    return { groupedLeads, totalSequences };
  }


  /**
   * Calculate campaign completion statistics
   * @param campaignId - The campaign ID
   * @returns Campaign stats including completion percentage
   */
  static async getCampaignStats(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: true,
        sequences: { where: { isActive: true } },
        analytics: true,
      },
    });

    if (!campaign) {
      return null;
    }

    const totalLeads = campaign.leads.length;
    const totalSequences = campaign.sequences.length;
    const totalEmailsNeeded = totalLeads * totalSequences;

    // Count emails by status
    const emailCounts = await prisma.emailSend.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { status: true },
    });

    const statusMap: Record<string, number> = {};
    emailCounts.forEach((item) => {
      statusMap[item.status] = item._count.status;
    });
    const sentCount = Number(statusMap["SENT"] || 0);
    const repliedCount = Number(statusMap["REPLIED"] || 0);
    const openedCount = Number(statusMap["OPENED"] || 0);
    const clickedCount = Number(statusMap["CLICKED"] || 0);
    const unsubscribedCount = Number(statusMap["UNSUBSCRIBED"] || 0);
    const queuedCount = Number(statusMap["QUEUED"] || 0);
    const failedCount = Number(statusMap["FAILED"] || 0);

    const totalProcessed = sentCount + repliedCount + openedCount + clickedCount + unsubscribedCount + failedCount;
    const totalSent = sentCount + repliedCount + openedCount + clickedCount + unsubscribedCount;
    // Calculate percentages
    const completedPercentage = totalEmailsNeeded > 0
      ? parseFloat(((totalSent / totalEmailsNeeded) * 100).toFixed(2))
      : 0;

    const progressPercentage = totalEmailsNeeded > 0
      ? parseFloat(((totalProcessed / totalEmailsNeeded) * 100).toFixed(2))
      : 0;

    // Count leads by status
    const leadCounts = await prisma.campaignLead.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { status: true },
    });

    const leadStatusMap: Record<string, number> = {};
    leadCounts.forEach((item) => {
      leadStatusMap[item.status] = item._count.status;
    });

    return {
      campaignId,
      totalLeads,
      totalSent,
      totalSequences,
      totalEmailsNeeded,

      // Email stats
      // emailsSent: sentCount,
      emailsQueued: queuedCount,
      emailsFailed: failedCount,

      // Lead stats
      leadsPending: leadStatusMap["PENDING"] || 0,
      leadsCompleted: leadStatusMap["SENT"] || 0,
      leadsReplied: leadStatusMap["REPLIED"] || 0,
      leadsBounced: leadStatusMap["BOUNCED"] || 0,

      // Percentages
      completedPercentage,    // Based on successfully sent emails
      progressPercentage,     // Based on all processed emails (sent + queued + failed)
    };
  }

  static async getSequenceAnalytics(
    campaignId: string
  ): Promise<SequenceAnalytics[]> {
    const sequences = await prisma.sequence.findMany({
      where: {
        campaignId,
        isActive: true,
      },
      orderBy: {
        seqNumber: 'asc',
      },
      include: {
        emailSends: {
          include: {
            events: true,
          },
        },
      },
    });

    return sequences.map(seq => {
      const stats: SequenceAnalytics = {
        emailType: seq.type,
        seqNumber: seq.seqNumber,
        subject: seq.subject ?? null,
        totalLeads: seq.emailSends.length,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        positiveReplies: 0,
        bounced: 0,
        senderBounced: 0,
        failed: 0,
        unsubscribed: 0,
      };

      for (const send of seq.emailSends) {
        // Send-level status
        switch (send.status) {
          case 'SENT':
            stats.sent++;
            break;
          case 'BOUNCED':
            stats.bounced++;
            break;
          case 'FAILED':
            stats.failed++;
            break;
        }

        // Event-level tracking
        for (const event of send.events) {
          switch (event.type) {
            case 'OPENED':
              stats.opened++;
              break;

            case 'CLICKED':
              stats.clicked++;
              break;

            case 'REPLIED':
              stats.replied++;
              break;

            case 'POSITIVE_REPLY':
              stats.positiveReplies++;
              break;

            case 'UNSUBSCRIBED':
              stats.unsubscribed++;
              break;
          }
        }
      }

      return stats;
    });
  }

  static async getCampaignInbox(campaignId: string) {
    const inbox = await prisma.emailSend.findMany({
      where: { campaignId },
      include: {
        lead: true,
        sender: true,
        sequence: true,
      },
      orderBy: {
        sentAt: 'desc',
      },
    });

    let inboxData = [];

    for (const send of inbox) {
      const variables = {
        firstName: send.lead.firstName ?? null,
        lastName: send.lead.lastName ?? null,
        company: send.lead.company ?? null,
        email: send.lead.email ?? null,
        signature: send.sender.signature ?? null,
      };

      const emailSubject = send.sequence?.subject ?? null;
      const replacedEmailSubject = emailSubject ? replaceTemplateVariables(emailSubject, variables) : null;
      const plainTextSubject = replacedEmailSubject ? htmlToPlainText(replacedEmailSubject) : null;

      const emailBody = send.sequence?.bodyHtml ?? send.sequence?.bodyText ?? "";
      const replacedEmailBody = emailBody ? replaceTemplateVariables(emailBody, variables) : null;
      const plainTextBody = replacedEmailBody ? htmlToPlainText(replacedEmailBody) : null;

      const sendData = {
        id: send.id,
        status: send.status,
        sentAt: send.sentAt,
        sequenceStep: send.sequenceStep,
        lead: {
          name: send.lead.lastName ? `${send.lead.firstName} ${send.lead.lastName}` : send.lead.firstName,
          email: send.lead.email,
        },
        sender: {
          email: send.sender.email,
        },
        messageSent: {
          subject: replacedEmailSubject,
          plainTextSubject: plainTextSubject,
          seqNumber: send.sequence?.seqNumber ?? null,
          body: {
            html: replacedEmailBody ?? null,
            text: plainTextBody ?? null,
          }
        },
        reply: {
          text: formatReplyText(send.replyText) ?? null,
          repliedAt: send.repliedAt ?? null,
        }
      };

      inboxData.push(sendData);
    }

    return inboxData;
  }

  static async changeCampaignStatus(campaignId: string, status: CampaignStatus) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { code: 404, message: "Campaign not found" };
    const data: { status: CampaignStatus; stoppedAt?: null; stoppedReason?: null; stoppedDetails?: null } = { status };
    if (status === "ACTIVE") {
      data.stoppedAt = null;
      data.stoppedReason = null;
      data.stoppedDetails = null;
    }
    const updatedCampaign = await prisma.campaign.update({ where: { id: campaignId }, data });
    return { code: 200, data: updatedCampaign, message: "success" };
  }
}

const calculateCampaignCompletionPercentage = (campaign: any) => {
  const totalExpected = campaign.leads.reduce((sum: number, lead: any) => {
    if (lead.stoppedAt) {
      return sum + lead.currentSequenceStep;
    }
    return sum + campaign.sequences.length;
  }, 0);

  const totalSent = campaign.analytics?.sentCount || 0;

  const completion =
    totalExpected === 0
      ? 0
      : Math.round((totalSent / totalExpected) * 100);

  return completion;
}

const replaceTemplateVariables = (template: string, variables: any) => {
  let out = template.replace(/{{(.*?)}}/g, (_, key) => variables[key.trim()] ?? "");
  out = out.replace(/%(\w+)%/g, (_, key) => String(variables[key] ?? ""));
  return out;
};

/**
 * Convert HTML to plain text - decodes entities and strips tags
 */
const htmlToPlainText = (html: string): string => {
  let text = html;
  
  // Convert block elements to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities (run twice for double-encoded)
  const decodeEntities = (str: string): string => {
    str = str.replace(/&amp;(#?\w+);/gi, "&$1;");
    str = str.replace(/&nbsp;/gi, " ");
    str = str.replace(/&amp;/gi, "&");
    str = str.replace(/&lt;/gi, "<");
    str = str.replace(/&gt;/gi, ">");
    str = str.replace(/&quot;/gi, '"');
    str = str.replace(/&#39;/gi, "'");
    str = str.replace(/&apos;/gi, "'");
    str = str.replace(/&#(\d+);/gi, (_, code) => String.fromCharCode(parseInt(code, 10)));
    str = str.replace(/\u00A0/g, " ");
    return str;
  };

  text = decodeEntities(decodeEntities(text));

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
};