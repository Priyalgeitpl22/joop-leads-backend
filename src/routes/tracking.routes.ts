import { Router } from "express";
import { trackEvent } from "../controllers/tracking.controller";

const router = Router();

router.get("/track-email/:trackingId/:type", trackEvent);

export default router;
