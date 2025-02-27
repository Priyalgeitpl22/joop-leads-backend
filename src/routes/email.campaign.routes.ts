import { Router } from "express";
import { addEmailCampaignSettings, addLeadsToCampaign, addSequenceToCampaign } from "../controllers/email.campaign.contoller";


const router = Router();

router.post("/add-leads-to-campaign", addLeadsToCampaign);
router.post("/add-sequence-to-campaign",addSequenceToCampaign)
router.post("/add-email-campaign-settings",addEmailCampaignSettings)


export default router;
