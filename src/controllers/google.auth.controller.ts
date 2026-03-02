import { Request, Response } from "express";
import { GoogleAuthService } from "../services/google.auth.service";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * GET /api/oauth/google
 * Redirects user to Google consent screen
 */
export const googleOAuthRedirect = (req: Request, res: Response): void => {
  try {
    const url = GoogleAuthService.getAuthUrl();
    res.redirect(url);
  } catch (err: any) {
    console.error("[GoogleOAuth] Failed to generate auth URL:", err.message);
    res.status(500).json({ code: 500, message: "Failed to initiate Google login" });
  }
};

/**
 * GET /api/oauth/callback
 * Google redirects here with ?code=...
 * Exchanges code → verifies → logs in or creates user → redirects to frontend
 */
export const googleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, error } = req.query;

  // User cancelled / OAuth error from Google
  if (error || !code) {
    console.warn("[GoogleOAuth] OAuth cancelled or error from Google:", error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_cancelled`);
    return;
  }

  try {
    const result = await GoogleAuthService.handleGoogleLogin(code as string);

    if (result.code !== 200 && result.code !== 201) {
      // Auth failed — redirect with error
      res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
      return;
    }

    // Success — redirect to frontend with token in query param
    // Frontend reads ?token= from URL, stores in localStorage, then removes it from URL
    const params = new URLSearchParams({
      token: result.token!,
      isNewUser: result.isNewUser ? "true" : "false",
    });

    res.redirect(`${FRONTEND_URL}/oauth/success?${params.toString()}`);
  } catch (err: any) {
    console.error("[GoogleOAuth] Callback error:", err.message);
    res.redirect(`${FRONTEND_URL}/login?error=server_error`);
  }
};