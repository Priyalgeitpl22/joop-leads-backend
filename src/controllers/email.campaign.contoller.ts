import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
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