import { Request, Response } from "express";
import { PrismaClient, SeqType, SequenceSchedularType } from "@prisma/client";
import multer from "multer";
import { Readable } from "stream";
import csv from "csv-parser";
import { json } from "stream/consumers";
import { uploadCSVToS3 } from "../aws/imageUtils";

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() }).single("csvFile");

export const addLeadsToCampaign = async (req: Request, res: Response): Promise<any> => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(500).json({ message: "File upload failed", error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (!req.body.emailFieldsToBeAdded) {
        return res.status(400).json({ message: "emailFieldsToBeAdded is required" });
      }

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
                const newContact = await prisma.contact.create({
                  data: contact,
                });

                insertedContacts.push(newContact);
                insertedIds.push(newContact.id);
            }

            const campaign = await prisma.emailCampaign.create({
              data: {
                campaignName: "new_campaign",
                csvSettings: csvSettings,
                csvFile: csvFileLocation,
                contacts: insertedIds
              },
            });

            return res.status(200).json({
              message: "File uploaded and contacts saved successfully",
              contactsInserted: insertedContacts.length,
              campaignId: campaign.id,
              code: 200
            });

          } catch (dbError: any) {
            return res.status(500).json({
              message: "Database error while saving contacts",
              error: dbError.message,
              code: 500
            });
          }
        })
        .on("error", (error) => {
          return res.status(500).json({
            message: "Error parsing CSV file",
            error: error.message,
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
      return res.status(400).json({ message: "Campaign ID is required" });
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaign_id },
    });

    if (!campaign) {
      return res
        .status(404)
        .json({ message: `Campaign with ID ${campaign_id} not found` });
    }

    if (!sequences || sequences.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one sequence is required" });
    }

    await prisma.$transaction(async (tx) => {
      try {
        const createdSequences = await tx.sequences.createMany({
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

        const sequenceIds = await tx.sequences.findMany({
          where: { campaign_id },
          select: { id: true },
        });

        await tx.emailCampaign.update({
          where: { id: campaign_id },
          data: {
            sequencesIds: sequenceIds.map((seq) => seq.id),
            sequences: {
              connect: sequenceIds.map((seq) => ({ id: seq.id })),
            },
          },
        });
      } catch (error: any) {
        console.error(`Error creating sequences: ${error.message}`);
        throw error;
      }
    });

    res.status(200).json({ message: "Sequence details saved successfully" });
  } catch (error: any) {
    console.error(`Error adding sequences to campaign: ${error.message}`);
    res.status(500).json({ message: "Server error. Please try again later." });
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
      return res.status(400).json({ message: "Campaign ID is required" });
    }

    // Convert objects to JSON strings for Prisma String[]
    const formattedSenderAccounts = sender_accounts.map((account: any) =>
      JSON.stringify(account)
    );

    if (typeof auto_warm_up !== "boolean") {
      return res
        .status(400)
        .json({ message: "Auto warm-up must be a boolean" });
    }
    if (typeof schedule_settings !== "object" || !schedule_settings) {
      return res
        .status(400)
        .json({ message: "Schedule settings must be an object" });
    }
    if (typeof campaign_settings !== "object" || !campaign_settings) {
      return res
        .status(400)
        .json({ message: "Campaign settings must be an object" });
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaign_id },
    });

    if (!campaign) {
      return res
        .status(404)
        .json({ message: `Campaign with ID ${campaign_id} not found` });
    }

    const newCampaignSettings = await prisma.emailCampaignSettings.create({
      data: {
        campaign_id,
        auto_warm_up,
        sender_accounts: formattedSenderAccounts, // Save as String[]
        campaign_schedule: schedule_settings,
        campaign_settings,
      },
    });

    return res.status(201).json({
      message: "Campaign settings saved successfully",
      data: newCampaignSettings,
    });
  } catch (error: any) {
    console.error("Prisma Error:", error); // Log full error
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
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
        },
        orderBy: {
          createdAt: "desc", // Orders campaigns by createdAt in descending order
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

