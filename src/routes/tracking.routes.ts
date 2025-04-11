import { Router } from "express";
import { processInboundEmail, trackEvent } from "../controllers/tracking.controller";

const router = Router();

router.get("/track-email/:trackingId/:type", trackEvent);
router.post('/inbound/email',processInboundEmail);

export default router;
