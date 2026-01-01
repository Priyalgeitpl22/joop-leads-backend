import { Router } from "express";
import { addLeadsToCampaign, getLeadsGroupedBySender, addSequenceToCampaign, addEmailCampaignSettings, getAllEmailCampaigns, getCampaignById, getAllSequences, getAllContacts, searchEmailCampaigns, scheduleEmailCampaign, updateCampaignStatus, deleteCampaign, filterEmailCampaigns, renameCampaign, getDashboardData, getSequenceAnalytics, getCampaignSenders, getCampaignsByLeadId, getCampaignInbox, changeCampaignStatus } from "../controllers/campaign.contoller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

router.get("/dashboard", verify, getDashboardData);

router.get("/search", verify, searchEmailCampaigns);
router.get("/filter", verify, filterEmailCampaigns);

router.post("/leads", verify, addLeadsToCampaign);

router.post("/sequences", verify, addSequenceToCampaign);
router.get("/sequences/:campaign_id", verify, getAllSequences);
router.get("/campaign-inbox/:id", verify, getCampaignInbox);

router.post("/settings", verify, addEmailCampaignSettings);
router.get("/", verify, getAllEmailCampaigns);
router.post("/schedule", verify, scheduleEmailCampaign);
router.put("/status", verify, updateCampaignStatus);
router.patch("/status", verify, updateCampaignStatus);

router.get("/contacts/:campaign_id", verify, getAllContacts);
router.get("/lead/:id/campaigns-by-lead", verify, getCampaignsByLeadId);

router.get("/:id/sequences/analytics", verify, getSequenceAnalytics);
router.get("/:id/leads/grouped-by-sender", verify, getLeadsGroupedBySender);
router.get("/:id/senders", verify, getCampaignSenders);
router.patch("/:campaign_id/rename", verify, renameCampaign);
router.delete("/:id", verify, deleteCampaign);
router.patch("/:id/change-status", verify, changeCampaignStatus);

// Generic campaign by ID (must be LAST among :id routes)
router.get("/:id", verify, getCampaignById);

export default router;
