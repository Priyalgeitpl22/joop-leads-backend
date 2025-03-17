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
      return res.status(404).json({ error: "Campaign analytics not found!" });
    }

    return res.status(200).json({ message: `Successfully updated ${countType}!` });
  } catch (error) {
    console.error("❌ Error updating campaign analytics:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
