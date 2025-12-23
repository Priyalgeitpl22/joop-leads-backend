import { Request, Response } from "express";
import { CampaignService } from "../services/campaign.service";

export const addLeadsToCampaign = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.addLeadsToCampaign(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const addSequenceToCampaign = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.addSequenceToCampaign(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const addEmailCampaignSettings = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.addEmailCampaignSettings(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const getAllEmailCampaigns = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.getAllEmailCampaigns(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const getCampaignById = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.getCampaignById(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const getAllSequences = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.getAllSequences(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const getAllContacts = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.getAllContacts(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const searchEmailCampaigns = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.searchEmailCampaigns(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const scheduleEmailCampaign = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.scheduleEmailCampaign(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const updateCampaignStatus = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.updateCampaignStatus(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.deleteCampaign(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const filterEmailCampaigns = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.filterEmailCampaigns(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const renameCampaign = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.renameCampaign(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    const response = await CampaignService.getDashboardData(req);
    res.status(response.code).json(response);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
  }
};
