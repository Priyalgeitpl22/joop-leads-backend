import { Router } from "express";
import {
  trackOpen,
  trackClick,
  trackReply,
  trackBounce,
  trackUnsubscribe,
  getAllThreadsFromEmail,
  trackEvent,
} from "../controllers/tracking.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

// =====================================================
// PUBLIC ROUTES (No auth - triggered by email clients)
// =====================================================

// Open tracking - embedded as image in email
// <img src="SERVER_URL/api/track/open/CAMPAIGN_ID_LEAD_EMAIL" />
router.get("/open/:trackingId", trackOpen);

// Click tracking - links replaced with this URL
// SERVER_URL/api/track/click/CAMPAIGN_ID_LEAD_EMAIL?url=ORIGINAL_URL
router.get("/click/:trackingId", trackClick);

// Unsubscribe - link in email footer
router.get("/unsubscribe/:trackingId", trackUnsubscribe);

// Legacy endpoint for backwards compatibility
router.get("/track-email/:trackingId/:type", trackEvent);

// =====================================================
// PROTECTED ROUTES (Requires auth - called by webhooks/API)
// =====================================================

// Reply tracking - called via webhook or manually
router.post("/reply", verify, trackReply);

// Bounce tracking - called via email provider webhook
router.post("/bounce", verify, trackBounce);

// Get all thread IDs for a sender (for reply detection)
router.get("/threads/:email", verify, getAllThreadsFromEmail);

export default router;
