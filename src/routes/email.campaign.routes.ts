import { Router } from "express";
import { addEmailCampaignSettings, addLeadsToCampaign, addSequenceToCampaign, deleteCampaign, filterEmailCampaigns, getAllContacts, getAllEmailCampaigns, getAllSequences, getCampaignById, getDashboardData, getEmailCampaignsBySender, removeFolderId, scheduleEmailCampaign, searchAccountInContacts, searchEmailCampaigns, updateCampaignStatus, updateFolderId } from "../controllers/email.campaign.contoller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();


router.get('/filter',authMiddleware,filterEmailCampaigns)
router.get('/sender-account', getEmailCampaignsBySender)
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
router.delete('/delete', deleteCampaign);
router.get('/dashboard/data', getDashboardData);
router.put("/status", updateCampaignStatus);

router.put("/email-campaign-add",updateFolderId);
router.put("/email-campaign-remove",removeFolderId);


 
export default router;
