import { Router } from "express";
import {
  addEmailCampaignSettings,
  addLeadsToCampaign,
  addSequenceToCampaign,
  createContact,
  deactivateContacts,

  getallContacts,

  getAllContactsByCampaignID,
  getAllEmailCampaigns,
  getAllSequences,
  getContactsByID,
  scheduleEmailCampaign,
  searchEmailCampaigns,
} from "../controllers/email.campaign.contoller";

const router = Router();
router.get('/contacts/:id',getContactsByID)
router.put('/schedule-campaign',scheduleEmailCampaign)
router.get("/", getAllEmailCampaigns);
router.post("/add-leads-to-campaign", addLeadsToCampaign);
router.post("/add-sequence-to-campaign", addSequenceToCampaign);
router.post("/add-email-campaign-settings", addEmailCampaignSettings);
router.get("/sequences/:campaign_id", getAllSequences);
router.get("/email-campaigns-search",searchEmailCampaigns)
// router.get("/contacts", getAllContactsByCampaignID);

router.get("/all-contacts",getallContacts)
router.patch('/contacts/deactivate',deactivateContacts)
router.post('/create-contacts',createContact)


export default router;
