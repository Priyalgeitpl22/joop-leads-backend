import { Router } from "express";
import { trackEvent, getAllThreadFormEmailId } from "../controllers/tracking.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

// Public routes - tracking pixels don't require auth
router.get("/track-email/:trackingId/:type", trackEvent);

// Protected routes
router.get("/threads/:email", verify, getAllThreadFormEmailId);

export default router;
