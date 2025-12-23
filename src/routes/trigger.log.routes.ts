import { Router } from "express";
import { verify } from "../middlewares/authMiddleware";
import { getTriggerLogs, getUpcomingTriggers } from "../controllers/trigger.logs.controller";

const router = Router();

router.get("/campaign/:campaignId", verify, getTriggerLogs);
router.get("/campaign/:campaignId/upcoming", verify, getUpcomingTriggers);

export default router;