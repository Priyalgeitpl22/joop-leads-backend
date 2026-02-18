import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateOtp, generateRandomToken } from "../utils/otp.utils";
import { sendOtpEmail, sendResetPasswordEmail } from "../utils/email.utils";
import { uploadImageToS3 } from "../aws/imageUtils";
import { assignFreePlanToOrg } from "./organization.plan.service";

const prisma = new PrismaClient();

export class AuthService {
  static async register(data: {
    email: string;
    fullName: string;
    password: string;
    orgName?: string;
    domain?: string;
    country?: string;
    phone?: string;
    profilePicture?: Express.Multer.File;
  }) {
    const { email, fullName, password, orgName, domain, country, phone, profilePicture } = data;

    const existingUser = await prisma.user.findUnique({ where: { email, isDeleted: false } });

    if (existingUser && !existingUser.isVerified) {
      const otp = generateOtp();
      await prisma.user.update({
        where: { email },
        data: { otpCode: otp.code, otpExpiresAt: otp.expiresAt },
      });
      await sendOtpEmail(email, otp.code);
      return { code: 200, message: "User found but not verified. A new OTP has been sent to your email." };
    }

    if (existingUser && existingUser.isVerified) {
      return { code: 400, message: "Email already exists and is verified. Please login instead." };
    }

    const organization = await prisma.organization.create({
      data: { name: orgName || "My Organization", domain, country, phone },
    });

    await assignFreePlanToOrg(organization.id);

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    let profilePictureUrl: string | null = null;
    if (profilePicture) {
      profilePictureUrl = await uploadImageToS3(profilePicture);
    }

    await prisma.user.create({
      data: {
        email,
        fullName,
        role: "ADMIN",
        orgId: organization.id,
        password: hashedPassword,
        otpCode: otp.code,
        otpExpiresAt: otp.expiresAt,
        profilePicture: profilePictureUrl,
      },
    });

    await sendOtpEmail(email, otp.code);
    return { code: 201, message: "User registered. Please verify your email with OTP." };
  }

  static async verifyOtp(email: string, otp: string) {
    const user = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!user) return { code: 404, message: "User not found" };

    if (!user.otpCode || user.otpCode !== otp) {
      return { code: 401, message: "Incorrect OTP" };
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      return { code: 410, message: "OTP expired" };
    }

    await prisma.user.update({
      where: { email },
      data: { isVerified: true, otpCode: null, otpExpiresAt: null },
    });

    return { code: 202, message: "Email verification successful" };
  }

  static async resendOtp(email: string) {
    const user = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!user) return { code: 404, message: "User not found" };

    if (user.otpExpiresAt && user.otpExpiresAt > new Date()) {
      return { code: 429, message: "OTP is still valid. Please wait before requesting a new OTP." };
    }

    const otp = generateOtp();
    await prisma.user.update({
      where: { email },
      data: { otpCode: otp.code, otpExpiresAt: otp.expiresAt },
    });

    await sendOtpEmail(email, otp.code);
    return { code: 200, message: "New OTP sent. Please check your email." };
  }

  static async forgetPassword(email: string) {
    if (!email) return { code: 400, message: "Email is required" };

    const existingUser = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!existingUser) return { code: 404, message: "User not found" };

    const tokenData = generateRandomToken(32, 3600);
    const resetPasswordLink = `${process.env.FRONTEND_URL}/reset-password?token=${tokenData.token}&email=${email}`;

    await sendResetPasswordEmail(email, existingUser.fullName, resetPasswordLink);
    await prisma.user.update({
      where: { email },
      data: { resetToken: tokenData.token, resetTokenExpiresAt: tokenData.expiresAt },
    });

    return { code: 202, message: "Password reset email sent successfully" };
  }

  static async resetPassword(token: string, password: string, email: string) {
    if (!token || !password || !email) {
      return { code: 400, message: "Token, password and email are required" };
    }

    const user = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!user) return { code: 404, message: "User not found" };

    if (!user.resetToken || user.resetToken !== token) {
      return { code: 403, message: "Invalid or expired token" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiresAt: null },
    });

    return { code: 200, message: "Password changed successfully" };
  }

  static async changePassword(email: string, existingPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!user) return { code: 404, message: "User not found" };

    const isPasswordValid = await bcrypt.compare(existingPassword, user.password);
    if (!isPasswordValid) return { code: 403, message: "Existing password is incorrect" };

    if (existingPassword === newPassword) {
      return { code: 400, message: "New password should not be the same as the existing password" };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { email }, data: { password: hashedPassword } });

    return { code: 200, message: "Password updated successfully" };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!user) return { code: 400, message: "User not found" };

    if (!user.isVerified) {
      return { code: 403, message: "Email verification required.", requiresVerification: true, canResendOtp: true };
    }

    const isUserValid = await bcrypt.compare(password, user.password);
    if (!isUserValid) return { code: 401, message: "Incorrect email or password" };

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: "1h" });

    await prisma.accessToken.create({
      data: {
        userId: user.id,
        isActive: true,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        token,
      },
    });

    return {
      code: 200,
      message: "User logged in successfully.",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  static async logout(token: string) {
    if (!token) return { code: 401, message: "Unauthorized: No token provided" };

    await prisma.accessToken.updateMany({
      where: { token },
      data: { isActive: false },
    });

    return { code: 200, message: "User logged out successfully" };
  }

  static async activateAccount(token: string, password: string, email: string) {
    if (!token || !password || !email) {
      return { code: 400, message: "Missing required fields: token, password, and email" };
    }

    const agent = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!agent) return { code: 404, message: "Agent not found" };

    if (agent.activationToken !== token) {
      return { code: 400, message: "Invalid or expired token" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, activationToken: null, activationTokenExpiresAt: null, isVerified: true },
    });

    return { code: 200, message: "Account activated successfully" };
  }
}

