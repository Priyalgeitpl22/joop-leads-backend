import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import { Readable } from "stream";
import csv from "csv-parser";
import { json } from "stream/consumers";

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() }).single("csvFile");

/**
 * Uploads a CSV file and saves its contents to the contacts table.
 * 
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<any>} A promise that resolves with the API response.
 */
export const addLeadsToCampaign = async (req: Request, res: Response): Promise<any> => {
  try {
    // Handle file upload
    upload(req, res, async (err) => {
      if (err) {
        return res.status(500).json({ message: "File upload failed", error: err.message });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Parse form data
      const emailFieldsToBeAdded = JSON.parse(req.body.emailFieldsToBeAdded);

      // Initialize an empty array to store the parsed CSV data
      const results: any[] = [];

      // Create a readable stream from the uploaded file
      const stream = Readable.from(req.file.buffer.toString());

      // Pipe the stream to the CSV parser
      stream
        .pipe(csv())
        .on("data", (data) => {
          const jsonData: any = {};
          Object.keys(emailFieldsToBeAdded).forEach((key, value) => {
            console.log(value);
            const actualKey = Object.keys(data).find((k) => k.trim().toLowerCase() === key.trim().toLowerCase());
            if (actualKey) {
              jsonData[key.toLowerCase().replace(" ", "_")] = data[actualKey] || "";
            }
          });
          
     
          results.push(jsonData);
        })
        .on("end", async () => {
          try {
            // Save the parsed data to the contacts table
            const insertedContacts = await prisma.contacts.createMany({
              data: results,
              skipDuplicates: true, // Avoid inserting duplicates
            });

            // Return a success response
            return res.status(200).json({
              message: "File uploaded and contacts saved successfully",
              insertedCount: insertedContacts.count,
            });
          } catch (dbError: any) {
            // Return a database error response
            return res.status(500).json({
              message: "Database error while saving contacts",
              error: dbError.message,
            });
          }
        })
        .on("error", (error: { message: any }) => {
          // Return a CSV parsing error response
          return res.status(500).json({
            message: "Error parsing CSV file",
            error: error.message,
          });
        });
    });
  } catch (error) {
    // Return an internal server error response
    return res.status(500).json({ message: "Internal server error", error });
  }
};