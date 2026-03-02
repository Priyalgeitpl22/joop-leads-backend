import { Router } from "express";
import { googleOAuthRedirect, googleOAuthCallback } from "../controllers/google.auth.controller";

const router = Router();

router.get("/google", googleOAuthRedirect);

router.get("/callback", googleOAuthCallback);

export default router;  