import { Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";
import multer from "multer";
import { Readable } from "stream";
import csv from "csv-parser";
import { getPresignedUrl, uploadCSVToS3 } from "../aws/imageUtils";
import { isValidEmail } from "../utils/email.utils";
import { CsvFile } from "../interfaces";
import fs from "fs";
import path from "path";
import { getChannel } from "../utils/rabbitmq";

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() }).single("csvFile");

interface AuthenticatedRequest extends Request {
  user?: User;
}

export const addLeadsToCampaign = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: "File upload failed", error: err.message });
      }

      const user = req.user;
      if (!user?.orgId) {
        return res.status(400).json({ code: 400, message: "Organization ID is required to create a campaign." });
      }

      if (!req.file) {
        return res.status(400).json({ code: 400, message: "No file uploaded" });
      }

      if (!req.body.emailFieldsToBeAdded) {
        return res.status(400).json({ code: 400, message: "emailFieldsToBeAdded is required" });
      }

      const campaignId = req.body.campaignId ? String(req.body.campaignId) : null;
      let campaign;

      if (campaignId) {
        campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

        if (!campaign) {
          return res.status(404).json({ code: 404, message: "Campaign not found" });
        }
      } else {
        campaign = await prisma.campaign.create({
          data: {
            orgId: user.orgId,
            campaignName: "Untitled Campaign",
            status: "DRAFT",
          },
        });

        await prisma.campaignAnalytics.create({
          data: {
            campaignId: campaign.id,
            orgId: user.orgId
          },
        });
      }

      const csvFileName = req.file.originalname;
      const csvFileLocation = await uploadCSVToS3(campaign.id, req.file);

      const csvSettings = typeof req.body.CSVsettings === "string"
        ? JSON.parse(req.body.CSVsettings)
        : req.body.CSVsettings;

      const emailFieldsToBeAdded: Record<string, string> = typeof req.body.emailFieldsToBeAdded === "string"
        ? JSON.parse(req.body.emailFieldsToBeAdded)
        : req.body.emailFieldsToBeAdded;

      const results: any[] = [];
      const stream = Readable.from(req.file.buffer).pipe(csv());

      let duplicateCount = 0,
        blockedCount = 0,
        emptyCount = 0,
        invalidCount = 0,
        unsubscribedCount = 0,
        skippedOtherCampaignCount = 0;

      stream.on("data", (data) => {
        const jsonData: Record<string, any> = {};

        Object.entries(emailFieldsToBeAdded).forEach(([csvKey, mappedKey]) => {
          if (typeof mappedKey === "string" && mappedKey !== "ignore_field") {
            const actualKey = Object.keys(data).find((k) => k.trim().toLowerCase() === csvKey.trim().toLowerCase());
            if (actualKey) {
              jsonData[mappedKey] = data[actualKey] || "";
            }
          }
        });

        results.push(jsonData);
      });

      stream.on("end", async () => {
        try {
          const insertedContacts = [];
          const emailCampaignRecords = [];

          for (const contact of results) {
            const email = contact?.email?.toLowerCase().trim();

            if (!email) {
              emptyCount++;
              continue;
            }

            const isValid = isValidEmail(email);

            const existingContact = await prisma.contact.findFirst({
              where: { email, orgId: user.orgId },
              select: { id: true, blocked: true, unsubscribed: true },
            });

            if (existingContact) {
              if (existingContact.blocked) {
                blockedCount++;
                continue;
              }

              if (!isValid) {
                invalidCount++;
                continue;
              }

              if (existingContact.unsubscribed) {
                unsubscribedCount++;
                continue;
              }

              // ✅ **Check if the contact already exists in this specific campaign**
              const existingCampaignContact = await prisma.emailCampaign.findFirst({
                where: { contactId: existingContact.id, campaignId: campaign.id },
                select: { id: true },
              });

              if (existingCampaignContact) {
                duplicateCount++;
                continue;
              }

              // ✅ **Check if the contact exists in any other campaign**
              if (csvSettings.ignoreDuplicateLeadsInOtherCampaign === 'true') {
                const otherCampaignContact = await prisma.emailCampaign.findFirst({
                  where: { contactId: existingContact.id },
                  select: { id: true },
                });

                if (otherCampaignContact) {
                  skippedOtherCampaignCount++;
                  continue;
                }
              }

              emailCampaignRecords.push({
                contactId: existingContact.id,
                campaignId: campaign.id,
              });

              continue;
            }

            // ✅ **Create new contact if it does not exist**
            const newContact = await prisma.contact.create({
              data: {
                ...contact,
                email,
                orgId: user.orgId,
                uploadedBy: user.id,
              },
            });

            insertedContacts.push(newContact);

            emailCampaignRecords.push({
              contactId: newContact.id,
              campaignId: campaign.id,
            });
          }

          // ✅ **Bulk insert into `emailCampaign` table**
          if (emailCampaignRecords.length > 0) {
            await prisma.emailCampaign.createMany({
              data: emailCampaignRecords,
            });
          }

          // ✅ **Update campaign metadata**
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              csvSettings: csvSettings,
              csvFile: { csvFileLocation: csvFileLocation, fileName: csvFileName },
              counts: {
                duplicateCount,
                blockedCount,
                emptyCount,
                invalidCount,
                unsubscribedCount,
                uploadedCount: emailCampaignRecords.length,
                skippedOtherCampaignCount,
              },
            },
          });

          return res.status(200).json({
            message: campaignId ? "Campaign updated successfully" : "File uploaded and contacts saved successfully",
            campaignId: campaign.id,
            counts: {
              duplicateCount,
              blockedCount,
              emptyCount,
              invalidCount,
              unsubscribedCount,
              uploadedCount: emailCampaignRecords.length,
              skippedOtherCampaignCount,
            },
            code: 200,
          });
        } catch (dbError: any) {
          return res.status(500).json({
            message: "Database error while saving contacts",
            error: dbError.message,
            code: 500,
          });
        }
      });

      stream.on("error", (error) => {
        return res.status(500).json({
          message: "Error parsing CSV file",
          error: error.message,
          code: 500,
        });
      });
    });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: "Internal server error", error: error.message });
  }
};

export const addSequenceToCampaign = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  const { campaign_id, sequences } = req.body;

  try {

    const user = req.user;

    if (!campaign_id) {
      return res.status(400).json({ code: 400, message: "Campaign ID is required" });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaign_id },
    });

    const campaign_analytics = await prisma.campaignAnalytics.findUnique({
      where: {
        campaignId: campaign_id
      }
    });

    if (!campaign_analytics && user) {
      await prisma.campaignAnalytics.create({
        data: {
          campaignId: campaign_id,
          orgId: user?.orgId
        },
      });
    }

    if (!campaign) {
      return res.status(404).json({ code: 404, message: `Campaign with ID ${campaign_id} not found` });
    }

    if (!sequences || sequences.length === 0) {
      return res.status(400).json({ code: 400, message: "At least one sequence is required" });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete existing sequences linked to this campaign
      await tx.sequences.deleteMany({ where: { campaign_id } });

      // 2. Insert new sequences if provided
      if (sequences.length > 0) {
        await tx.sequences.createMany({
          data: sequences.map((seq: any) => ({
            campaign_id,
            seq_number: seq.seq_number,
            seq_type: seq.seq_type,
            seq_delay_details: seq.seq_delay_details,
            sequence_schedular_type: seq.sequence_schedular_type,
            variant_distribution_type: seq.variant_distribution_type,
            seq_variants: seq.seq_variants,
          })),
        });
      }

      // 3. Retrieve newly inserted sequence IDs
      const newSequenceIds = await tx.sequences.findMany({
        where: { campaign_id },
        select: { id: true },
      });

      // 4. Update campaign with new sequences (NO `sequencesIds`)
      if (newSequenceIds.length > 0) {
        await tx.campaign.update({
          where: { id: campaign_id },
          data: {
            sequences: {
              connect: newSequenceIds.map((seq) => ({ id: seq.id })),
            },
          },
        });
      }
    });

    res.status(200).json({
      data: { campaign_id },
      code: 200,
      message: "Sequence details saved successfully"
    });
  } catch (error: any) {
    console.error(`Error adding sequences to campaign: ${error.message}`);
    res.status(500).json({ code: 500, message: "Server error. Please try again later." });
  }
};

export const addEmailCampaignSettings = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    campaign_id,
    auto_warm_up,
    sender_accounts,
    schedule_settings,
    campaign_settings,
  } = req.body;

  try {
    if (!campaign_id) {
      return res.status(400).json({ code: 400, message: "Campaign ID is required" });
    }

    const formattedSenderAccounts = sender_accounts?.map((account: any) => account.account_id) ?? [];

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaign_id },
    });

    if (!campaign) {
      return res
        .status(404)
        .json({ code: 404, message: `Campaign with ID ${campaign_id} not found` });
    }

    const existingSettings = await prisma.emailCampaignSettings.findFirst({
      where: { campaign_id },
    });

    let updatedSettings;
    if (existingSettings) {
      updatedSettings = await prisma.emailCampaignSettings.update({
        where: { id: existingSettings.id },
        data: {
          campaign_id,
          auto_warm_up: auto_warm_up ?? existingSettings.auto_warm_up,
          sender_accounts: sender_accounts,
          campaign_schedule: schedule_settings ?? existingSettings.campaign_schedule,
          campaign_settings: campaign_settings ?? existingSettings.campaign_settings,
        },
      });
    } else {
      updatedSettings = await prisma.emailCampaignSettings.create({
        data: {
          campaign_id,
          auto_warm_up,
          sender_accounts: sender_accounts,
          campaign_schedule: schedule_settings,
          campaign_settings,
        },
      });
    }

    const campaignName = campaign_settings?.campaignName || campaign.campaignName;

    await prisma.campaign.update({
      where: { id: campaign_id },
      data: {
        campaignName: campaignName,
      },
    });

    return res.status(200).json({
      code: 200,
      message: "Campaign settings saved successfully",
    });
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return res
      .status(500)
      .json({ code: 500, message: "Server error", error: error.message });
  }
};

export const getAllEmailCampaigns = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {

    const user = req.user;

    const campaignId = req.query.campaign_id
      ? String(req.query.campaign_id)
      : undefined;

    if (campaignId) {
      const data = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      res.status(200).json({ code: 200, data, message: "success" });
    } else {
      let data = await prisma.campaign.findMany({
        where: {
          orgId: user?.orgId
        },
        select: {
          id: true,
          campaignName: true,
          createdAt: true,
          sequencesIds: true,
          sequences: true,
          csvSettings: true,
          csvFile: true,
          schedule: true,
          status: true,
          CampaignAnalytics: true,
          EmailTriggerLog: true,
          emailCampaigns: {
            include: {
              contact: true, 
            },
          },
          
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      data = data.map((campaign) => ({
        ...campaign,
        sequence_count: campaign.sequencesIds.length,
        analytics_count: campaign.CampaignAnalytics[0],
        contact_count: campaign.emailCampaigns.length,
        contacts: campaign.emailCampaigns.map((ec) => ec.contact),
      }));
      res.status(200).json({ code: 200, data, message: "success" });
    }
  } catch (err) {
    console.error("Error fetching email campaigns:", err);
    res
      .status(500)
      .json({ code: 500, message: "Error fetching email campaigns" });
  }
};

export const getCampaignById = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {

    const campaignId = req.params.id
      ? String(req.params.id)
      : undefined;

    let campaignDetails = await prisma.campaign.findUnique({
      where: {
        id: campaignId
      },
      include: {
        sequences: {
          orderBy: {
            seq_number: 'asc'
          }
        },
        CampaignAnalytics: true,
        EmailTriggerLog: true,
        email_campaign_settings: true,
        emailCampaigns: {
          where: {
            campaignId: campaignId
          },
          include: {
            contact: true
          }
        }
      }
    });

    let contacts = campaignDetails?.emailCampaigns?.map(ec => ec.contact) || [];
    let sender_accounts = campaignDetails?.email_campaign_settings?.[0]?.sender_accounts || [];
    let sequences = campaignDetails?.sequences || [];
    let campaign_settings = campaignDetails?.email_campaign_settings?.[0]?.campaign_settings || {};
    let campaign_schedule = campaignDetails?.email_campaign_settings?.[0]?.campaign_schedule || {};

    let csv_file;
    if (
      campaignDetails?.csvFile &&
      typeof campaignDetails.csvFile === "object"
    ) {
      const csvFileData = campaignDetails.csvFile as unknown as CsvFile;
      csv_file = await getPresignedUrl(csvFileData.csvFileLocation);
    }

    const csv_detials = campaignDetails?.csvFile as unknown as CsvFile;

    let campaignStats;
    if (campaignDetails) {
      const totalLeads = campaignDetails.emailCampaigns.length;
      const totalSequences = campaignDetails.sequences.length;
      const totalEmailsNeeded = totalLeads * totalSequences;

      const totalEmailsSent = campaignDetails.EmailTriggerLog.length;

      const completedPercentage =
        totalEmailsNeeded > 0
          ? ((totalEmailsSent / totalEmailsNeeded) * 100).toFixed(2)
          : "0";

      const leadsYetToStart = campaignDetails.emailCampaigns.filter((emailCampaign) => {
        return !campaignDetails.EmailTriggerLog.some((log) => log.email === emailCampaign.contact.email);
      }).length;

      const leadsInProgress = campaignDetails.emailCampaigns.filter((emailCampaign) => {
        const leadEmails = campaignDetails.EmailTriggerLog.filter(
          (log) => log.email === emailCampaign.contact.email
        );

        return leadEmails.length > 0 && leadEmails.length < totalSequences;
      }).length;

      const leadsCompleted = campaignDetails.emailCampaigns.filter((emailCampaign) => {
        const leadEmails = campaignDetails.EmailTriggerLog.filter(
          (log) => log.email === emailCampaign.contact.email
        );

        return leadEmails.length === totalSequences;
      }).length;

      const totalSequencesLeft = totalSequences - Math.floor(totalEmailsSent / totalLeads);

      let nextSequenceTrigger: string | null = null;
      const lastSentEmails = campaignDetails.EmailTriggerLog.sort(
        (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
      );

      if (lastSentEmails.length > 0) {
        const lastSentTime = new Date(lastSentEmails[0].triggeredAt);
        nextSequenceTrigger = new Date(lastSentTime.getTime() + 24 * 60 * 60 * 1000).toISOString(); // Next day
      }

      campaignStats = {
        completedPercentage: completedPercentage,
        totalLeads,
        leadsYetToStart,
        leadsInProgress,
        leadsCompleted,
        totalSequencesLeft,
        nextSequenceTrigger: nextSequenceTrigger ?? null,
        status: campaignDetails.status
      };
    }

    let campaign = {
      id: campaignDetails?.id,
      createdAt: campaignDetails?.createdAt,
      contacts,
      campaignStats,
      sender_accounts,
      sequences,
      analytics_count: campaignDetails?.CampaignAnalytics[0],
      campaign_settings,
      campaign_schedule,
      csv_file: { ...csv_detials, csv_file, uploadedAt: campaignDetails?.createdAt, uploadCounts: campaignDetails?.counts }
    };

    res.status(200).json({ code: 200, campaign: campaign, message: "success" });
  } catch (err) {
    console.error("Error fetching email campaigns:", err);
    res
      .status(500)
      .json({ code: 500, message: "Error fetching email campaigns" });
  }
};

export const getAllSequences = async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.campaign_id
      ? String(req.params.campaign_id)
      : undefined;

    const sequence_id = req.query.sequence_id
      ? String(req.query.sequence_id)
      : undefined;

    const data = sequence_id
      ? await prisma.sequences.findUnique({ where: { id: sequence_id } })
      : await prisma.sequences.findMany({
        where: {
          campaign_id: campaignId
        },
        orderBy: {
          seq_number: "asc",
        },
      });

    const total = sequence_id ? undefined : await prisma.sequences.count();
    if (sequence_id && !data) {
      res.status(404).json({ code: 404, message: "Contact not found" });
    }
    res
      .status(200)
      .json({
        code: 200,
        data,
        total,
        message: data ? "Success" : "No contacts found",
      });
  } catch (err) {
    console.error("Error fetching email campaigns:", err);
    res
      .status(500)
      .json({ code: 500, message: "Error fetching email campaigns" });
  }
};

export const getAllContacts = async (req: Request, res: Response): Promise<any> => {
  try {
    const campaignId = req.params.campaign_id
      ? String(req.params.campaign_id)
      : undefined;

    const data = await prisma.emailCampaign.findMany({
      where: { campaignId: campaignId },
      include: { contact: true },
    });

    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: "No contacts found" });
    }


    const contacts = data.flatMap((campaign) => campaign.contact);

    res.status(200).json({
      code: 200,
      data: contacts,
      total: contacts.length,
      message: "Success",
    });
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ code: 500, message: "Error fetching contacts" });
  }
};
export const searchEmailCampaigns = async (req: AuthenticatedRequest, res: any) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query : "";
    const user = req.user;

    if (!query) {
      return res.status(400).json({ code: 400, message: "Campaign name is required" });
    }

    if (!user?.orgId) {
      return res.status(401).json({ code: 401, message: "Unauthorized" });
    }

    let data = await prisma.campaign.findMany({
      where: {
        campaignName: { contains: query, mode: "insensitive" },
        orgId: user.orgId,
      },
      select: {
        campaignName: true,
        id: true,
        createdAt: true,
        sequencesIds: true,
        sequences: true,
        csvSettings: true,
        csvFile: true,
        schedule: true,
        status: true,
        CampaignAnalytics: true,
        EmailTriggerLog: true,
        emailCampaigns: {
          select: {
            contact: true,
          },
        },
      },
    });

    data = data.map((campaign) => ({
      ...campaign,
      analytics_count: campaign.CampaignAnalytics?.length || 0,
      contact_count: campaign.emailCampaigns.filter((ec) => ec.contact).length,
      contacts: campaign.emailCampaigns
        .filter((ec) => ec.contact)
        .map((ec) => ec.contact),
    }));

    res.status(200).json({
      code: 200,
      data,
      message: data.length ? "Success" : "No campaigns found",
    });
  } catch (err) {
    console.error("Error fetching email campaigns:", err);
    res.status(500).json({ code: 500, message: "Error fetching email campaigns" });
  }
};

export const scheduleEmailCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId, status } = req.body;
    if (!campaignId || !status) {
      res
        .status(400)
        .json({ code: 400, message: "campaignId and status are required" });
    }
    const data = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
    });

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status },
    });
    const channel = await getChannel();
    const queueName = process.env.QUEUE_NAME;
    if (!queueName) throw new Error("Email Queue name is undefined!");
    channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify({ campaignId: campaignId })))
    res
      .status(200)
      .json({ code: 200, data: updatedCampaign, message: "success" });
  } catch (err) {
    console.error("Error fetching email campaigns:", err);
    res
      .status(500)
      .json({ code: 500, message: "Error fetching email campaigns" });
  }
};

export const updateCampaignStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId, status } = req.body;

    if (!campaignId || !status) {
      return res.status(400).json({
        code: 400,
        message: "campaignId and status are required",
      });
    }

    const existingCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!existingCampaign) {
      return res.status(404).json({
        code: 404,
        message: "Campaign not found",
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status },
    });

    return res.status(200).json({
      code: 200,
      data: updatedCampaign,
      message: "Campaign status updated successfully",
    });

  } catch (err) {
    console.error("Error updating campaign status:", err);
    return res.status(500).json({
      code: 500,
      message: "Error updating campaign status",
    });
  }
};

export const getEmailCampaignsBySender = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = req.query.sender_account_id as string;
    const user = req.user;
    if (!accountId) {
      return res
        .status(400)
        .json({ code: 400, message: "sender_account_id is required" });
    }

    const campaigns = await prisma.campaign.findMany({
      include: {
        email_campaign_settings: {
          select: {
            sender_accounts: true,
          },
        },
      },
    });

    const filteredCampaigns = campaigns
      .map((campaign) => ({
        campaign_id: campaign.id,
        campaign_name: campaign.campaignName,
        campaign_status: campaign.status,
        sender_accounts: campaign.email_campaign_settings.flatMap(
          (setting) => setting.sender_accounts
        ),
        created_at: campaign.createdAt,
      }))
      .filter((campaign) =>
        campaign.sender_accounts.some(
          (account: any) => account.account_id === accountId
        )
      );
    const campaignMessage = filteredCampaigns.length
      ? "Campaigns found for this account"
      : "No campaigns found for this account.";

    return res.status(200).json({
      code: 200,
      campaigns: filteredCampaigns,
      usedInCount: filteredCampaigns.length,
      message: campaignMessage,
    });
  } catch (err: any) {
    return res.status(500).json({
      code: 500,
      message: "Error fetching email campaigns",
      details: err.message,
    });
  }
};

export const deleteCampaign = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const campaignId = req.query.campaign_id as string;

    if (!campaignId) {
      return res
        .status(400)
        .json({ code: 400, message: "campaign_id is required" });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({ code: 404, message: "Campaign not found" });
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return res
      .status(200)
      .json({ code: 200, message: "Campaign deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting campaign:", error);
    return res
      .status(500)
      .json({
        code: 500,
        message: "Error deleting campaign",
        details: error.message,
      });
  }
};
export const searchAccountInContacts = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaign_id } = req.query;
    const { email } = req.query;
    if (!campaign_id) {
      return res.status(400).json({ code: 400, message: "Campaign ID is required" });
    }
    const contacts = await prisma.emailCampaign.findMany({
      where: { campaignId: String(campaign_id) },
      include: { contact: true },
    });
    if (!contacts || contacts.length === 0) {
      return res.status(404).json({ code: 404, message: "No contacts found for this campaign" });
    }
    let contactList = contacts.map((c) => c.contact);
    if (email) {
      contactList = contactList.filter((contact) => contact.email?.toLowerCase().includes(String(email).toLowerCase()));
    }
    if (contactList.length === 0) {
      return res.status(404).json({ code: 404, message: "No matching contacts found" });
    }
    res.status(200).json({
      code: 200,
      data: contactList,
      total: contactList.length,
      message: "Success",
    });
  } catch (err) {
    console.error("Error searching contacts:", err);
    res.status(500).json({ code: 500, message: "Error searching contacts" });
  }
};

export const getDashboardData = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const user = req.user;
    const total_leads = await prisma.contact.count({
      where: {
        orgId: user?.orgId
      }
    });

    const analytics_count = await prisma.campaignAnalytics.findMany({
      where: {
        orgId: user?.orgId
      }
    });

    const total_sent_count = analytics_count.reduce(
      (sum, campaign) => sum + campaign.sent_count,
      0
    );

    const total_bounced_count = analytics_count.reduce(
      (sum, campaign) => sum + campaign.bounced_count,
      0
    );

    const total_running_campaigns = await prisma.campaign.count({
      where: {
        orgId: user?.orgId,
        status: 'RUNNING'
      }
    });

    const total_completed_campaigns = await prisma.campaign.count({
      where: {
        orgId: user?.orgId,
        status: 'COMPLETED'
      }
    });

    const total_drafted_campaigns = await prisma.campaign.count({
      where: {
        orgId: user?.orgId,
        status: 'DRAFT'
      }
    });

    const total_scheduled_campaigns = await prisma.campaign.count({
      where: {
        orgId: user?.orgId,
        status: 'SCHEDULED'
      }
    });

    const total_paused_campaigns = await prisma.campaign.count({
      where: {
        orgId: user?.orgId,
        status: 'PAUSED'
      }
    });

    const data = {
      total_leads,
      total_sent_count,
      total_bounced_count,
      total_running_campaigns,
      total_completed_campaigns,
      total_drafted_campaigns,
      total_scheduled_campaigns,
      total_paused_campaigns
    }

    return res.status(200).json({ code: 200, message: "Campaign deleted successfully", data: data });
  } catch (error: any) {
    console.error("Error deleting campaign:", error);
    return res
      .status(500)
      .json({
        code: 500,
        message: "Error deleting campaign",
        details: error.message,
      });
  }
};
export const updateFolderId = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId, folderId } = req.body;

    if (!campaignId || !folderId) {
      return res.status(400).json({
        code: 400,
        message: "campaignId and folderId are required",
      });
    }

    const existingCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!existingCampaign) {
      return res.status(404).json({
        code: 404,
        message: "Campaign not found",
      });
    }

    const existingMapping = await prisma.campaignFolderMapping.findUnique({
      where: {
        campaignId_folderId: {
          campaignId: campaignId,
          folderId: folderId,
        },
      },
    });

    if (existingMapping) {
      return res.status(400).json({
        code: 400,
        message: "This campaign is already added to the specified folder.",
      });
    }
    const updatedCampaign = await prisma.campaignFolderMapping.create({
      data: {
        campaignId,
        folderId,
      },
    });

    return res.status(200).json({
      code: 200,
      data: updatedCampaign,
      message: "Campaign folder updated successfully",
    });

  } catch (err) {
    console.error("Error updating campaign folder:", err);
    return res.status(500).json({
      code: 500,
      message: "Error updating campaign folder",
    });
  }
};

export const removeFolderId = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { campaignId, folderId } = req.body;

    if (!campaignId || !folderId) {
      return res.status(400).json({
        code: 400,
        message: "campaignId and folder Id are required"
      })
    }
    const existingMapping = await prisma.campaignFolderMapping.findFirst({
      where: { campaignId, folderId },
    });

    if (!existingMapping) {
      return res.status(404).json({
        code: 404,
        message: "Campaign not found"
      })
    }

    await prisma.campaignFolderMapping.delete({
      where: { id: existingMapping.id },
    });

    return res.status(200).json({
      code: 200,
      message: "Campaign from folder Removed sucessfully"
    })

  } catch (err) {
    console.log("Error Removing campaign from folder ", err);
    return res.status(500).json({
      code: 500,
      message: "Error in Removing the campaign from folder ",
    });
  }
}

export const filterEmailCampaigns = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { status, startDate, endDate } = req.query;
    const user = req.user;

    if (!user?.orgId) {
      return res.status(401).json({ code: 401, message: "Unauthorized" });
    }
    const filters: any = { orgId: user.orgId };

    if (status) {
      filters.status = { contains: status as string, mode: "insensitive" };
    }

    if (startDate) {
      const parsedStartDate = new Date(startDate as string);
      if (isNaN(parsedStartDate.getTime())) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid start date format." });
      }
      filters.createdAt = {
        ...(filters.createdAt || {}),
        gte: parsedStartDate,
      };
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate as string);
      if (isNaN(parsedEndDate.getTime())) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid end date format." });
      }
      filters.createdAt = { ...(filters.createdAt || {}), lte: parsedEndDate };
    }

    let data = await prisma.campaign.findMany({
      where: filters,
      select: {
        campaignName: true,
        id: true,
        createdAt: true,
        sequencesIds: true,
        sequences: true,
        csvSettings: true,
        csvFile: true,
        schedule: true,
        status: true,
        CampaignAnalytics: true,
        EmailTriggerLog: true,
      },
    });


    data = data.map((campaign) => ({
      ...campaign,
      analytics_count: campaign.CampaignAnalytics?.length || 0,
    }));


    res.status(200).json({
      code: 200,
      data,
      message: data.length ? "Success" : "No campaigns found",
    });
  } catch (err) {
    console.error("Error fetching email campaigns:", err);
    res.status(500).json({ code: 500, message: "Error fetching email campaigns" });
  }
};

export const renameCampaign = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { newName } = req.body;
    const { campaignId } = req.params;

    if (!newName) {
      return res.status(400).json({
        code: 400,
        message: "Invalid input or missing",
      });
    }

    const existingCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!existingCampaign) {
      return res.status(404).json({
        code: 404,
        message: `Campaign with the specified Id:${campaignId} does not exist`,
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { campaignName: newName },
    });

    return res.status(200).json({
      code: 200,
      data: updatedCampaign,
      message: "Campaign renamed successfully",
    });
  } catch (err) {
    console.error("Error updating campaign status:", err);
    return res.status(500).json({
      code: 500,
      message: "Error updating campaign status",
    });
  }
};

