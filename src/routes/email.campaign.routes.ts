import { Router } from "express";
import { addLeadsToCampaign, addSequenceToCampaign } from "../controllers/email.campaign.contoller";


const router = Router();

router.post("/add-leads-to-campaign", addLeadsToCampaign);
router.post("/add-sequence-to-campaign",addSequenceToCampaign)


export default router;
