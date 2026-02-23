import { Router, Request, Response } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import organizationRoutes from "./organization.routes";
import campaignRoutes from "./campaign.routes";
import leadRoutes from "./lead.routes";
import trackingRoutes from "./tracking.routes";
import planRoutes from "./plan.routes";
import addOnRoutes from "./add-on.routes";
import organizationPlanRoutes from "./organisation.plan.routes";
import { verify } from "../middlewares/authMiddleware";
import { enforcePlanLimits } from "../middlewares/enforcePlanLimits";
import senderAccountRoutes from "./sender.account.routes";
import triggerLogRoutes from "./trigger.log.routes";
import campaignAnalyticsRoutes from "./campaign.analytics.routes";
import campaignSenderRoutes from "./campaign.sender.routes";
import emailVerificationRoutes from './email.verification.routes';
import { pollForReplies } from "../jobs/replyPoller";

// Add with your other protected routes (after verify middleware)
const router = Router();

// Public routes
router.use("/auth", authRoutes);
router.use("/track", trackingRoutes);

// Protected routes
router.use("/user", verify, userRoutes);
router.use("/org", verify, organizationRoutes);
router.use("/campaign", verify, campaignRoutes);
router.use("/lead", verify, leadRoutes);
router.use("/plan", planRoutes);
router.use("/add-on", addOnRoutes);
router.use("/org-plan", organizationPlanRoutes);
router.use("/sender-account", verify, senderAccountRoutes);
router.use("/trigger-log", verify, triggerLogRoutes);
router.use("/campaign-analytics", verify, campaignAnalyticsRoutes);
router.use("/campaign-sender", verify, campaignSenderRoutes);
router.use("/email-verification", verify, emailVerificationRoutes);

// Manual trigger for reply poller
router.post("/poll-replies", async (req: Request, res: Response) => {
  try {
    console.log("[API] Manual reply poll triggered");
    // Run in background, don't wait for completion
    pollForReplies().catch((err) => {
      console.error("[API] Reply poll error:", err.message);
    });
    res.json({ success: true, message: "Reply polling started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
