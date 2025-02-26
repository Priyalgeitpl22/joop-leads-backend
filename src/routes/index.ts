import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import agentRoutes from "./agent.routes";
import organizationRoutes from "./organization.routes";
import messageRoutes from "./message.routes";
import threadRoutes from "./thread.routes";
import chatConfigRoutes from "./chatConfig.routes";
import { authMiddleware } from "../middlewares/authMiddleware";
import  emailCampaignRoutes from './email.campaign.routes'

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", authMiddleware, userRoutes);
router.use("/org", authMiddleware, organizationRoutes);
router.use("/agent", authMiddleware, agentRoutes);
router.use("/message", authMiddleware, messageRoutes);
router.use("/thread", authMiddleware, threadRoutes);
router.use("/chat/config", authMiddleware, chatConfigRoutes);
router.use("/email-campaign",emailCampaignRoutes)

export default router;
