import { Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";
import multer from "multer";
import { Readable } from "stream";
import csv from "csv-parser";
import { uploadCSVToS3 } from "../aws/imageUtils";
import { isValidEmail } from "../utils/email.utils";

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

      const campaign = await prisma.campaign.create({
        data: {
          orgId: user.orgId,
          campaignName: "new_campaign",
          status: "DRAFT",
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
      const stream = Readable.from(req.file.buffer).pipe(csv());

      let duplicateCount = 0,
        blockedCount = 0,
        emptyCount = 0,
        invalidCount = 0,
        unsubscribedCount = 0;

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

              duplicateCount++;

              emailCampaignRecords.push({
                contactId: existingContact.id,
                campaignId: campaign.id,
              });

              continue;
            }

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

          if (emailCampaignRecords.length > 0) {
            await prisma.emailCampaign.createMany({
              data: emailCampaignRecords,
            });
          }

          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              csvSettings: csvSettings,
              csvFile: csvFileLocation,
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
              uploadedCount: insertedContacts.length,
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
  req: Request,
  res: Response
): Promise<any> => {
  const { campaign_id, sequences } = req.body;

  try {
    if (!campaign_id) {
      return res.status(400).json({ code: 400, message: "Campaign ID is required" });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaign_id },
    });

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
          sender_accounts: formattedSenderAccounts.length === 0 ? existingSettings.sender_accounts : formattedSenderAccounts,
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

export const getAllEmailCampaigns = async (req: Request, res: Response): Promise<any> => {
  try {
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
        select: {
          campaignName: true,
          createdAt: true,
          sequencesIds: true,
          sequences: true,
          csvSettings: true,
          csvFile: true,
          schedule: true,
          status: true,
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

// export const createContact = async (req: Request, res: Response) => {
//   try {
//     const {
//       first_name,
//       last_name,
//       email,
//       phone_number,
//       company_name,
//       website,
//       location,
//       orgId,
//       file_name,
//       blocked = false,
//       unsubscribed = false,
//       active = true,
//     } = req.body;

//     const orgExists = await prisma.organization.findUnique({
//       where: { id: orgId },
//     });

//     if (!orgExists) {
//       res.status(404).json({ code: 404, message: "Organization not found" });
//     }

//     const newContact = await prisma.contact.create({
//       data: {
//         first_name,
//         last_name,
//         email,
//         phone_number,
//         company_name,
//         website,
//         location,
//         orgId,
//         file_name,
//         blocked,
//         unsubscribed,
//         active,
//       },
//     });

//     res.status(201).json({
//       code: 201,
//       message: "Contact created successfully",
//       data: newContact,
//     });
//   } catch (error) {
//     console.error("Error creating contact:", error);
//     res.status(500).json({ code: 500, message: "Error creating contact" });
//   }
// };

// export const createCampaignFromContacts = async (req: Request, res: Response) => {
//   try {
//     const { campaignName, contactIds } = req.body;

//     if (!campaignName || !Array.isArray(contactIds) || contactIds.length === 0) {
//       return res.status(400).json({ code: 400, message: "campaignName and contactIds are required" });
//     }

//     // Validate contacts
//     const existingContacts = await prisma.contact.findMany({
//       where: { id: { in: contactIds } },
//     });

//     if (existingContacts.length !== contactIds.length) {
//       return res.status(404).json({ code: 404, message: "Some contacts not found" });
//     }

//     // Create new campaign
//     const newCampaign = await prisma.campaign.create({
//       data: {
//         campaignName,
//         status: "DRAFT",
//         contactslist: {
//           connect: contactIds.map((id) => ({ id })),
//         },
//       },
//     });

//     return res.status(201).json({
//       code: 201,
//       message: "Campaign created successfully",
//       data: newCampaign,
//     });
//   } catch (error) {
//     console.error("Error creating campaign:", error);
//     return res.status(500).json({ code: 500, message: "Error creating campaign" });
//   }
// };

export const getContactsById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        uploadedUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        emailCampaigns: {
          select: {
            campaign: {
              select: {
                id: true,
                campaignName: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ code: 404, message: "Contact not found" });
    }

    res.status(200).json({
      code: 200,
      message: `Contact fetched with id ${id}`,
      data: {
        ...contact,
      },
    });
  } catch (err) {
    console.error("Error fetching contact:", err);
    res.status(500).json({ code: 500, message: "Error fetching contact" });
  }
};

export const getallContacts = async (req: AuthenticatedRequest, res: Response): Promise<any>  => {

  try {
    const user = req.user;
    if (!user?.orgId) {
      return res.status(400).json({ code: 400, message: "Organization ID is required to create a campaign." });
    }

    const contactsWithCampaignCount = await prisma.contact.findMany({
      include: {
        emailCampaigns: {
          select: {
            campaignId: true,
          },
        },
      },
    });
    
    const result = contactsWithCampaignCount.map((contact) => ({
      ...contact,
      used_in_campaigns: contact.emailCampaigns.length,
    }));
    
    if (!result) {
      res.status(404).json({ code: 404, message: "Contact not found" });
    } else {
      res.status(200).json({
        code: 200,
        message: "Contacts fetched successfully",
        data: result,
      });
  
    }
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ code: 500, message: "Error fetching contacts" });
  }
};

export const getAllContactsByCampaignId = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ code: 400, message: "Campaign ID is required" });
    }

    const emailCampaigns = await prisma.emailCampaign.findMany({
      where: { campaignId: id as string },
      select: { contact: true },
    });

    const contacts = emailCampaigns.map((ec) => ec.contact);

    const campaign = await prisma.campaign.findUnique({
      where: { id: id as string },
    });

    if (!campaign) {
      return res.status(404).json({ code: 404, message: "Campaign not found" });
    }

    const totalCount = await prisma.emailCampaign.count({
      where: { campaignId: id as string },
    });

    return res.status(200).json({
      code: 200,
      message: "Contacts and campaign details fetched successfully",
      data: contacts,
      totalCount
    });
  } catch (err) {
    console.error("Error fetching contacts and campaign history:", err);
    return res.status(500).json({ code: 500, message: "Error fetching data" });
  }
};

// export const deactivateContacts = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.body;

//     const contact = await prisma.contact.findUnique({ where: { id } });

//     if (!contact) {
//    res.status(404).json({ code: 404, message: "Contact not found" });
//     }

//     // Assuming 'blocked' is the field used for deactivation
//     const updatedContact = await prisma.contact.update({
//       where: { id },
//       data: { active: false },
//     });

//     res.status(200).json({
//       code: 200,
//       message: `Contact with ID ${id} has been deactivated`,
//       data: updatedContact,
//     });
//   } catch (err) {
//     console.error("Error fetching contacts:", err);
//     res.status(500).json({ code: 500, message: "Error fetching contacts" });
//   }
// };

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

export const searchEmailCampaigns = async (req:any,res:any) => {
  try {
    const { campaign_name } = req.query;
    if (!campaign_name) {
      return res
        .status(400)
        .json({ code: 400, message: "Campaign name is required" });
    }

    const data = await prisma.campaign.findMany({
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