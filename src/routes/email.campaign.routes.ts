import { Router } from "express";
import { addLeadsToCampaign } from "../controllers/email.campaign.contoller";


const router = Router();

router.post("/add-leads-to-campaign", addLeadsToCampaign);


export default router;
