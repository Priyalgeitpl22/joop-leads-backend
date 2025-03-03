import { Router } from "express";
import {
  addEmailCampaignSettings,
  addLeadsToCampaign,
  addSequenceToCampaign,
  getAllContacts,
  getAllEmailCampaigns,
  getAllSequences,
  searchEmailCampaigns,
} from "../controllers/email.campaign.contoller";

const router = Router();

router.get("/", getAllEmailCampaigns);
router.post("/add-leads-to-campaign", addLeadsToCampaign);
router.post("/add-sequence-to-campaign", addSequenceToCampaign);
router.post("/add-email-campaign-settings", addEmailCampaignSettings);
router.get("/contacts/:campaign_id", getAllContacts);
router.get("/sequences/:campaign_id", getAllSequences);
router.get("/email-campaigns-search",searchEmailCampaigns)

export default router;
