import { Router } from "express";
import { addEmailCampaignSettings, addLeadsToCampaign, addSequenceToCampaign, getAllEmailCampaigns, getAllSequences,scheduleEmailCampaign, searchEmailCampaigns } from "../controllers/email.campaign.contoller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();


router.put('/schedule-campaign',authMiddleware, scheduleEmailCampaign)
router.get("/", authMiddleware, getAllEmailCampaigns);
router.post("/add-leads-to-campaign", authMiddleware, addLeadsToCampaign);
router.post("/add-sequence-to-campaign", authMiddleware, addSequenceToCampaign);
router.post("/add-email-campaign-settings", authMiddleware, addEmailCampaignSettings);
router.get("/sequences/:campaign_id", authMiddleware, getAllSequences);
router.get("/email-campaigns-search", authMiddleware, searchEmailCampaigns);


export default router;
