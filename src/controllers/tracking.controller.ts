import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

const VALID_COUNT_TYPES = [
  "opened_count",
  "clicked_count",
  "replied_count",
  "positive_reply_count",
  "bounced_count",
];

export const trackEvent = async (req: Request, res: Response): Promise<any> => {
  try {
    const { trackingId, type } = req.params;

    if (!VALID_COUNT_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid tracking type" });
    }

    const [campaignId, email] = trackingId.split("_");
    console.log(`🔍 Tracking Event: ${type} for ${email} in campaign ${campaignId}`);

    // Log the event
    const logMessage = `${type.toUpperCase()}: ${trackingId} - ${new Date().toISOString()}\n`;
    fs.appendFileSync("email_tracking.log", logMessage);

    // Update count in DB
    await prisma.campaignAnalytics.upsert({
      where: { campaignId_email: { campaignId, email } },
      update: { [type]: { increment: 1 } },
      create: {
        campaignId,
        email,
        opened_count: 0,
        clicked_count: 0,
        replied_count: 0,
        positive_reply_count: 0,
        bounced_count: 0,
        [type]: 1, // Initialize the specific count
      },
    });

    if (type === "opened_count") {
      const imagePath = path.join(__dirname, "transparent.png");
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ message: "Tracking image not found" });
      }
      return res.sendFile(imagePath);
    }

    res.status(200).json({ message: `✅ ${type} updated for ${email}` });
  } catch (error: any) {
    console.error("Error tracking event:", error);
    res.status(500).json({
      message: "Error tracking event",
      details: error.message,
    });
  }
};
