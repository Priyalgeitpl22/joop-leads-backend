import { Router } from "express";
import { verify } from "../middlewares/authMiddleware";
import { getAllCampaignsByAccountId } from "../controllers/campaign.sender.controller";

const router = Router();

router.get("/:accountId", verify, getAllCampaignsByAccountId);

export default router;