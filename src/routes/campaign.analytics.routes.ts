import { Router } from "express";
import { verify } from "../middlewares/authMiddleware";
import { getCampaignAnalytics, getOrgAnalytics } from "../controllers/analytics.controller";

const router = Router();

router.get("/campaign/:campaignId", verify, getCampaignAnalytics);
router.get("/org/:orgId", verify, getOrgAnalytics);

export default router;