import { Router } from "express";
import { addLeadsToCampaign, addSequenceToCampaign, addEmailCampaignSettings, getAllEmailCampaigns, getCampaignById, getAllSequences, getAllContacts, searchEmailCampaigns, scheduleEmailCampaign, updateCampaignStatus, deleteCampaign, filterEmailCampaigns, renameCampaign, getDashboardData } from "../controllers/campaign.contoller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

// Dashboard
router.get("/dashboard", verify, getDashboardData);

// Leads
router.post("/leads", verify, addLeadsToCampaign);

// Sequences
router.post("/sequences", verify, addSequenceToCampaign);
router.get("/sequences/:campaign_id", verify, getAllSequences);

// Campaign settings
router.post("/settings", verify, addEmailCampaignSettings);
router.get("/", verify, getAllEmailCampaigns);
router.get("/:id", verify, getCampaignById);
router.get("/contacts/:campaign_id", verify, getAllContacts);

// Search & Filter
router.get("/search", verify, searchEmailCampaigns);
router.get("/filter", verify, filterEmailCampaigns);
router.put("/status", verify, updateCampaignStatus);
// Campaign actions
router.post("/schedule", verify, scheduleEmailCampaign);
router.patch("/status", verify, updateCampaignStatus);
router.delete("/:campaignId", verify, deleteCampaign);
router.patch("/:campaignId/rename", verify, renameCampaign);

export default router;
