import { Router } from "express";
import {
  addEmailCampaignSettings,
  addLeadsToCampaign,
  addSequenceToCampaign,
  getAllContacts,
  getAllEmailCampaigns,
  getAllSequences,
} from "../controllers/email.campaign.contoller";

const router = Router();

router.post("/add-leads-to-campaign", addLeadsToCampaign);
router.post("/add-sequence-to-campaign", addSequenceToCampaign);
router.post("/add-email-campaign-settings", addEmailCampaignSettings);
router.get("/get-all-email-campaigns", getAllEmailCampaigns);
router.get("/get-contacts",getAllContacts);
router.get("/get-sequences",getAllSequences)

export default router;
