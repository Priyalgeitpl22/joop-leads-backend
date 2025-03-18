import { Router } from "express";
import { addEmailCampaignSettings, addLeadsToCampaign, addSequenceToCampaign, deleteCampaign, getAllContacts, getAllEmailCampaigns, getAllSequences, getCampaignById, getEmailCampaignsBySender, scheduleEmailCampaign, searchAccountInContacts, searchEmailCampaigns } from "../controllers/email.campaign.contoller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.get('/search-contact',searchAccountInContacts)
router.put('/schedule-campaign', authMiddleware, scheduleEmailCampaign)
router.get("/", authMiddleware, getAllEmailCampaigns);
router.get("/:id", authMiddleware, getCampaignById);
router.post("/add-leads-to-campaign", authMiddleware, addLeadsToCampaign);
router.post("/add-sequence-to-campaign", authMiddleware, addSequenceToCampaign);
router.post("/add-email-campaign-settings", authMiddleware, addEmailCampaignSettings);
router.get("/sequences/:campaign_id", authMiddleware, getAllSequences);
router.get("/contacts/:campaign_id", authMiddleware, getAllContacts);
router.get("/search/campaign", authMiddleware, searchEmailCampaigns);
router.get('/get-campaigns-by-sender', getEmailCampaignsBySender)
router.delete('/delete', deleteCampaign)


export default router;
