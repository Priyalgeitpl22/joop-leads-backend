import { Router } from "express";
import { addEmailCampaignSettings, addLeadsToCampaign, addSequenceToCampaign, createContact, deactivateContacts, getallContacts, getAllEmailCampaigns, getAllSequences, getContactsById, scheduleEmailCampaign, searchContacts, searchEmailCampaigns } from "../controllers/email.campaign.contoller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.get('/contact/:id',authMiddleware,getContactsById)
router.put('/schedule-campaign',authMiddleware, scheduleEmailCampaign)
router.get("/", authMiddleware, getAllEmailCampaigns);
router.post("/add-leads-to-campaign", authMiddleware, addLeadsToCampaign);
router.post("/add-sequence-to-campaign", authMiddleware, addSequenceToCampaign);
router.post("/add-email-campaign-settings", authMiddleware, addEmailCampaignSettings);
router.get("/sequences/:campaign_id", authMiddleware, getAllSequences);
router.get("/email-campaigns-search", authMiddleware, searchEmailCampaigns);
router.get("/contacts/:id", authMiddleware, getAllContactsByCampaignId);
router.get("/all-contacts", authMiddleware, getallContacts);
router.patch('/contacts/deactivate', authMiddleware, deactivateContacts);
router.get('/contact/:id', getContactsById);
router.post('/create-contacts', authMiddleware, createContact);
router.get('/search-contacts',searchContacts)

export default router;
