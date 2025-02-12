import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import agentRoutes from "./agent.routes";
import organizationRoutes from "./organization.routes";
import messageRoutes from "./message.routes";
import threadRoutes from "./thread.routes";
import chatConfigRoutes from "./chatConfig.routes";
import chatScriptRoutes from "./chatScript.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/org", organizationRoutes);
router.use("/agent", agentRoutes);
router.use("/message", messageRoutes);
router.use("/thread", threadRoutes);
router.use("/chat/config", chatConfigRoutes);
router.use("/chat-widget.js", chatScriptRoutes);

export default router;
