import { Router } from "express";
import { trackEvent,getAllThreadFormEmailId } from "../controllers/tracking.controller";

const router = Router();

router.get("/track-email/:trackingId/:type", trackEvent);
router.get("/track-email/:email",getAllThreadFormEmailId)

export default router;
