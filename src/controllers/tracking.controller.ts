import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { incrementCampaignCount } from "./analytics.controller";

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
    const { redirect } = req.query;

    if (!VALID_COUNT_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid tracking type: ${type}` });
    }

    const [campaignId, email] = trackingId.split("_");
    console.log(`🔍 Tracking Event: ${type} for ${email} in campaign ${campaignId}`);

    if (type === "opened_count") {
      console.log("One email opened");
      const log = await prisma.emailTriggerLog.findFirst({
        where: {
          campaignId,
          email,
        },
      });
      console.log("log", log);
      if (log) {
        const data = await prisma.emailTriggerLog.update({
          where: { id: log.id },
          data: { email_opened: true },
        });
      }
      incrementCampaignCount(campaignId, "opened_count");

      console.log("One email opened");

      const imagePath = path.join(__dirname, "transparent.png");
      if (fs.existsSync(imagePath)) {
        res.setHeader("Content-Type", "image/png");
        return res.sendFile(imagePath);
      } else {
        console.warn("⚠️ Tracking image not found!");
        return res.status(404).json({ message: "Tracking image not found" });
      }
    }

    if (type === "clicked_count" && redirect) {
      const log = await prisma.emailTriggerLog.findFirst({
        where: {
          campaignId,
          email,
        },
      });
      console.log("log", log);
      if (log) {
        const data = await prisma.emailTriggerLog.update({
          where: { id: log.id },
          data: { email_clicked: true },
        });
      }
      incrementCampaignCount(campaignId, "clicked_count");
      console.log("One email clicked");
      console.log(`🔀 Redirecting to: ${redirect}`);
      return res.redirect(redirect.toString());
    }

    if (type === "replied_count") {
      console.log(`📩 Reply detected from ${email}`);
      const log = await prisma.emailTriggerLog.findFirst({
        where: {
          campaignId,
          email,
        },
      });

      if (log) {
        const data = await prisma.emailTriggerLog.update({
          where: { id: log.id },
          data: { replied_mail: true },
        });
      }
      incrementCampaignCount(campaignId, "replied_count");

      console.log("Replied to one email");
    }

    res.status(200).json({ message: `✅ ${type} updated for ${email}` });
  } catch (error: any) {
    console.error("❌ Error tracking event:", error.message);
    res.status(500).json({
      message: "Error tracking event",
      details: error.message,
    });
  }
};
