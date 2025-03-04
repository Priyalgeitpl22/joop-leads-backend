import { Request, Response } from "express";
import { PrismaClient, SeqType, SequenceSchedularType } from "@prisma/client";
import multer from "multer";
import { Readable } from "stream";
import csv from "csv-parser";
import { uploadCSVToS3 } from "../aws/imageUtils";
import { isValidEmail } from "../utils/email.utils";

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() }).single("csvFile");

export const addLeadsToCampaign = async (req: Request, res: Response): Promise<any> => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: "File upload failed", error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ code: 400, message: "No file uploaded" });
      }

      if (!req.body.emailFieldsToBeAdded) {
        return res.status(400).json({ code: 400, message: "emailFieldsToBeAdded is required" });
      }

      const campaign = await prisma.emailCampaign.create({
        data: {
          campaignName: "new_campaign"
        },
      });

      const csvFile = req.file;
      const csvFileLocation = await uploadCSVToS3(csvFile);

      const csvSettings = typeof req.body.CSVsettings === "string"
        ? JSON.parse(req.body.CSVsettings)
        : req.body.CSVsettings;

      const emailFieldsToBeAdded: Record<string, string> = typeof req.body.emailFieldsToBeAdded === "string"
        ? JSON.parse(req.body.emailFieldsToBeAdded)
        : req.body.emailFieldsToBeAdded;

      const results: any[] = [];
      const stream = Readable.from(req.file.buffer.toString());

      let duplicateCount = 0,
        blockedCount = 0,
        emptyCount = 0,
        invalidCount = 0,
        unsubscribedCount = 0;

      stream.pipe(csv())
        .on("data", (data) => {
          const jsonData: Record<string, any> = {};

          Object.entries(emailFieldsToBeAdded).forEach(([csvKey, mappedKey]) => {
            if (typeof mappedKey === "string" && mappedKey !== 'ignore_field') {
              const actualKey = Object.keys(data).find((k) => k.trim().toLowerCase() === csvKey.trim().toLowerCase());
              if (actualKey) {
                jsonData[mappedKey] = data[actualKey] || "";
              }
            }
          });
          results.push(jsonData);
        })
        .on("end", async () => {
          try {
            const insertedContacts = [];
            const insertedIds = [];

            for (const contact of results) {
              const email = contact?.email?.toLowerCase().trim();

              if (!email) {
                emptyCount++;
                continue;
              }

              const isValid = isValidEmail(email);

              const existingContact = await prisma.contact.findFirst({
                where: { email },
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

                duplicateCount++;
                continue;
              }

              const newContact = await prisma.contact.create({
                data: { campaign_id: campaign.id, ...contact },
              });

              insertedContacts.push(newContact);
              insertedIds.push(newContact.id);
            }

            await prisma.emailCampaign.update({
              where: {
                id: campaign.id
              },
              data: {
                csvSettings: csvSettings,
                csvFile: csvFileLocation,
                contacts: insertedIds,
              },
            });

            return res.status(200).json({
              message: "File uploaded and contacts saved successfully",
              campaignId: campaign.id,
              counts: {
                duplicateCount,
                blockedCount,
                emptyCount,
                invalidCount,
                unsubscribedCount,
                uploadedCount: insertedContacts.length
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
        })
        .on("error", (error) => {
          return res.status(500).json({
            message: "Error parsing CSV file",
            error: error.message,
            code: 500,
          });
        });
    });
  } catch (error) {
    return res.status(500).json({ code: 500, message: "Internal server error", error });
  }
};

export const addSequenceToCampaign = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { campaign_id, sequences } = req.body;

  try {
    if (!campaign_id) {
      return res.status(400).json({ code: 400, message: "Campaign ID is required" });
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaign_id },
    });

    if (!campaign) {
      return res
        .status(404)
        .json({ code: 404, message: `Campaign with ID ${campaign_id} not found` });
    }

    if (!sequences || sequences.length === 0) {
      return res
        .status(400)
        .json({ code: 400, message: "At least one sequence is required" });
    }

    await prisma.$transaction(async (tx) => {
      try {
        await tx.sequences.deleteMany({
          where: { campaign_id },
        });
    
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

        const newSequenceIds = await tx.sequences.findMany({
          where: { campaign_id },
          select: { id: true },
        });

        await tx.emailCampaign.update({
          where: { id: campaign_id },
          data: {
            sequencesIds: newSequenceIds.map((seq) => seq.id),
            sequences: {
              connect: newSequenceIds.map((seq) => ({ id: seq.id })),
            },
          },
        });
      } catch (error: any) {
        console.error(`Error creating sequences: ${error.message}`);
        throw error;
      }
    });

    res.status(200).json({ data: { campaign_id }, code: 200, message: "Sequence details saved successfully" });
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

    const formattedSenderAccounts = sender_accounts?.map((account: any) => {
      return account.account_id;
    });


    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaign_id },
    });

    if (!campaign) {
      return res
        .status(404)
        .json({ code: 404, message: `Campaign with ID ${campaign_id} not found` });
    }

    const existingSettings = await prisma.emailCampaignSettings.findFirst({
      where: {
        campaign_id
      }
    });

    let updatedSettings;
    if (existingSettings) {
      updatedSettings = await prisma.emailCampaignSettings.update({
        where: {
          id: existingSettings.id
        },
        data: {
          campaign_id,
          auto_warm_up: auto_warm_up ?? existingSettings.auto_warm_up,
          sender_accounts: formattedSenderAccounts?.length === 0 ? existingSettings.sender_accounts : formattedSenderAccounts,
          campaign_schedule: schedule_settings ?? existingSettings.campaign_schedule,
          campaign_settings: campaign_settings ?? existingSettings.campaign_settings,
        },
      });

    } else {
      updatedSettings = await prisma.emailCampaignSettings.create({
        data: {
          campaign_id,
          auto_warm_up,
          sender_accounts: formattedSenderAccounts,
          campaign_schedule: schedule_settings,
          campaign_settings,
        },
      });
    }

    const updatedCampaign = await prisma.emailCampaign.update({
      where: {
        id: campaign_id
      },
      data: {
        email_campaign_settings_id: updatedSettings.id,
        campaignName: campaign_settings?.campaign_name,
      }
    });

    return res.status(200).json({
      code: 200,
      message: "Campaign settings saved successfully",
      // data: newCampaignSettings,
    });
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return res
      .status(500)
      .json({ code: 500, message: "Server error", error: error.message });
  }
};

export const getAllEmailCampaigns = async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaign_id
      ? String(req.query.campaign_id)
      : undefined;

    if (campaignId) {
      const data = await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
      });
      res.status(200).json({ code: 200, data, message: "success" });
    } else {
      let data = await prisma.emailCampaign.findMany({
        select: {
          campaignName: true,
          createdAt: true,
          sequencesIds: true,
          sequences: true,
          csvSettings: true,
          csvFile: true,
          schedule: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });


      data = data.map((campaign) => ({
        ...campaign,
        sequence_count: campaign.sequencesIds.length,
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

export const getAllContacts = async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.campaign_id
      ? String(req.params.campaign_id)
      : undefined;

    const contact_id = req.query.contact_id
      ? String(req.query.contact_id)
      : undefined;

    const data = contact_id
      ? await prisma.contact.findUnique({ where: { id: contact_id } })
      : campaignId
        ? await prisma.contact.findMany({ where: { id: campaignId } })
        : null;

    const total = contact_id ? undefined : await prisma.contact.count();
    if (contact_id && !data) {
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

export const getAllSequences = async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.campaign_id
      ? String(req.params.contact_id)
      : undefined;

    const sequence_id = req.query.sequence_id
      ? String(req.query.sequence_id)
      : undefined;

    const data = sequence_id
      ? await prisma.sequences.findUnique({ where: { id: sequence_id } })
      : await prisma.sequences.findMany({
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

export const searchEmailCampaigns = async (req:any,res:any) => {
  try {
    const { campaign_name } = req.query;
    if (!campaign_name) {
      return res
        .status(400)
        .json({ code: 400, message: "Campaign name is required" });
    }

    const data = await prisma.emailCampaign.findMany({
      where: { campaignName: { contains: campaign_name, mode: "insensitive" } },
    });

    res.status(200).json({
      code: 200,
      data,
      message: data ? "Success" : "No contacts found",
    });
  } catch (err) {
    console.error("Error fetching email campaigns:", err);
    res
      .status(500)
      .json({ code: 500, message: "Error fetching email campaigns" });
  }
};
