import { Router } from "express";
import { verify } from "../middlewares/authMiddleware";
import { getCampaignAnalytics } from "../controllers/analytics.controller";

const router = Router();

router.get("/:campaignId", verify, getCampaignAnalytics);

export default router;