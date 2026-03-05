import { PrismaClient, PlanCode } from "@prisma/client";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { OrganizationPlanService } from "./organization.plan.service";

const prisma = new PrismaClient();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export class GoogleAuthService {

  /**
   * Step 1 — Generate the Google OAuth consent screen URL
   */
  static getAuthUrl(): string {
    return googleClient.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "consent",
    });
  }

  /**
   * Step 2 — Exchange the auth code for tokens and verify the ID token
   */
  static async getGoogleUser(code: string): Promise<{
    email: string;
    fullName: string;
    profilePicture: string | null;
    googleId: string;
  }> {
    const { tokens } = await googleClient.getToken(code);

    if (!tokens.id_token) {
      throw new Error("No ID token returned from Google");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error("Failed to extract user info from Google token");
    }

    return {
      email: payload.email,
      fullName: payload.name || payload.email.split("@")[0],
      profilePicture: payload.picture || null,
      googleId: payload.sub,
    };
  }

  /**
   * Step 3 — Generate app JWT + store access token (same as login())
   */
  private static async generateAppToken(userId: string, role: string): Promise<string> {
    const token = jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    await prisma.accessToken.create({
      data: {
        userId,
        isActive: true,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        token,
      },
    });

    return token;
  }

  /**
   * Main handler — covers all cases:
   *   1. New user       → create org + user → login
   *   2. Existing user  → login
   *   3. Deleted user   → reactivate → login
   */
  static async handleGoogleLogin(code: string): Promise<{
    code: number;
    message: string;
    token?: string;
    user?: { id: string; email: string; role: string; provider: string };
    isNewUser?: boolean;
  }> {
    // ── 1. Verify Google token ────────────────────────────────────────────────
    let googleUser: Awaited<ReturnType<typeof GoogleAuthService.getGoogleUser>>;
    try {
      googleUser = await GoogleAuthService.getGoogleUser(code);
    } catch (err: any) {
      console.error("[GoogleAuthService] Token verification failed:", err.message);
      return { code: 401, message: "Google authentication failed. Please try again." };
    }

    const { email, fullName, profilePicture, googleId } = googleUser;

    // ── 2. Look up user (including deleted) ───────────────────────────────────
    const existingUser = await prisma.user.findUnique({ where: { email } });

    // ── 3a. Deleted user → reactivate ─────────────────────────────────────────
    if (existingUser && existingUser.isDeleted) {
      const reactivated = await prisma.user.update({
        where: { email },
        data: {
          isDeleted: false,
          deletedAt: null,
          isActive: true,
          isVerified: true,
          profilePicture: profilePicture ?? existingUser.profilePicture,
          providerType: 'GOOGLE',
        },
      });

      const token = await GoogleAuthService.generateAppToken(reactivated.id, reactivated.role);

      console.log(`[GoogleAuthService] ♻️ Reactivated deleted account: ${email}`);
      return {
        code: 200,
        message: "Your account has been reactivated. Welcome back!",
        token,
        user: { id: reactivated.id, email: reactivated.email, role: reactivated.role, provider: reactivated.providerType },
      };
    }

    // ── 3b. Existing active user → log in ─────────────────────────────────────
    if (existingUser) {
      // Mark as verified if somehow not (e.g. registered via email but never verified)
      if (!existingUser.isVerified) {
        await prisma.user.update({
          where: { email },
          data: { isVerified: true },
        });
      }

      const token = await GoogleAuthService.generateAppToken(existingUser.id, existingUser.role);

      console.log(`[GoogleAuthService] ✅ Existing user logged in via Google: ${email}`);
      return {
        code: 200,
        message: "User logged in successfully.",
        token,
        user: { id: existingUser.id, email: existingUser.email, role: existingUser.role, provider: existingUser.providerType },
      };
    }

    // ── 3c. New user → create org + user ──────────────────────────────────────
    const organization = await prisma.organization.create({
      data: { name: `${fullName}'s Organization` },
    });

    // Assign free plan (same as email register flow)
    await OrganizationPlanService.assignPlan(organization.id, PlanCode.FREE, "MONTHLY");

    const newUser = await prisma.user.create({
      data: {
        email,
        fullName,
        // Google users have no password — set a random unguessable hash
        // They can set a password later via forget-password flow if needed
        password: `google_oauth_${googleId}_${Date.now()}`,
        role: "ADMIN",
        orgId: organization.id,
        isVerified: true,   // Google has already verified the email
        isActive: true,
        profilePicture,
        providerType: 'GOOGLE',
      },
    });

    const token = await GoogleAuthService.generateAppToken(newUser.id, newUser.role);

    console.log(`[GoogleAuthService] 🆕 New user registered via Google: ${email}`);
    return {
      code: 201,
      message: "Account created successfully.",
      token,
      isNewUser: true,
      user: { id: newUser.id, email: newUser.email, role: newUser.role, provider: newUser.providerType },
    };
  }
}