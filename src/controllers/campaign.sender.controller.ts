import { Request, Response } from "express";
import { CampaignSenderService } from "../services/campaign.sender.service";

export const getAllCampaignsByAccountId = async (req: Request, res: Response): Promise<void> => {

  try {
    const accountId = String(req.params.accountId);
    const campaigns = await CampaignSenderService.getAllCampaignsByAccountId(accountId);

    if (campaigns.length === 0) {
      res.status(404).json({ code: 404, message: "No campaigns found" });
      return;
    }

    const data = campaigns.map((campaign) => ({
        id: campaign.campaign.id,
        name: campaign.campaign.name,
        description: campaign.campaign.description,
        status: campaign.campaign.status,
        createdAt: campaign.campaign.createdAt,
        updatedAt: campaign.campaign.updatedAt,
    }));
    
    res.status(200).json({ code: 200, message: "Campaigns fetched successfully", data });
    return;
  } catch (error) {
    res.status(500).json({ code: 500, message: "Error fetching campaigns", error: error instanceof Error ? error.message : "Unknown error" });
    return;
  }
}