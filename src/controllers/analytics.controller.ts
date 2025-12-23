import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VALID_COUNT_TYPES = [
  "opened_count",
  "clicked_count",
  "replied_count",
  "positive_reply_count",
  "bounced_count",
];

const isValidCountType = (countType: string): boolean => {
  return VALID_COUNT_TYPES.includes(countType);
};

export const incrementCampaignCount = async (campaignId: string, countType: string) => {
  return await prisma.campaignAnalytics.updateMany({
    where: { campaignId },
    data: { [countType]: { increment: 1 } },
  });
};

export const updateCampaignAnalytics = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId, countType } = req.body;

    if (!campaignId || !countType) {
      return res.status(400).json({ error: "campaignId and countType are required!" });
    }

    if (!isValidCountType(countType)) {
      return res.status(400).json({ error: "Invalid countType provided!" });
    }

    const result = await incrementCampaignCount(campaignId, countType);

    if (result.count === 0) {
      res.json({ code: 404, message: "Campaign analytics not found!" });
    }

    res.json({ code: 200, message: `Successfully updated ${countType}!` });
  } catch (error) {
    console.error("Error updating campaign analytics:", error);
    res.json({ code: 500, message: "Error updating campaign analytics" });
  }
};

export const getCampaignAnalytics = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId } = req.params;
    const analytics = await prisma.campaignAnalytics.findUnique({
      where: { campaignId },
    });
    if (!analytics) {
      return res.status(404).json({ code: 404, message: "Campaign analytics not found!" });
    }
    res.status(200).json({ code: 200, message: "Campaign analytics fetched successfully", data: analytics });
  } catch (error) {
    console.error("Error getting campaign analytics:", error);
    res.status(500).json({ code: 500, message: "Error getting campaign analytics" });
  }
};
