import { Router } from "express";
import {
  addEmailCampaignSettings,
  addLeadsToCampaign,
  addSequenceToCampaign,
  deactivateContacts,
  getAllContacts,
  getAllEmailCampaigns,
  getAllSequences,
  getContactsByID,
  scheduleEmailCampaign,
  searchEmailCampaigns,
} from "../controllers/email.campaign.contoller";

const router = Router();
router.put('/schedule-campaign',scheduleEmailCampaign)
router.get("/", getAllEmailCampaigns);
router.post("/add-leads-to-campaign", addLeadsToCampaign);
router.post("/add-sequence-to-campaign", addSequenceToCampaign);
router.post("/add-email-campaign-settings", addEmailCampaignSettings);
router.get("/sequences/:campaign_id", getAllSequences);
router.get("/email-campaigns-search",searchEmailCampaigns)
router.get("/contacts", getAllContacts);
router.get('/contacts/:id',getContactsByID)
router.patch('/contacts/deactivate',deactivateContacts)


export default router;
