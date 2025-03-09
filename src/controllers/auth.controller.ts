import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOtpEmail, sendResetPasswordEmail } from '../utils/email.utils';
import { generateOtp, generateRandomToken } from '../utils/otp.utils';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from "multer";
import { uploadImageToS3 } from '../aws/imageUtils';
import { UserRoles } from '../enums';

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() }).single("profilePicture");

export const register = async (req: Request, res: Response): Promise<any> => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ code: 400,message: "File upload failed", error: err });
        }

        const { email, fullName, orgName, domain, country, phone, password } = req.body;

        if (!email || !fullName ||  !password) {
            return res.status(400).json({ code: 400,message: "All fields are required." });
        }
        try {
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({code: 400, message: "Email already exists" });
            }

            const organizationData = {
                name: orgName,
                domain,
                country,
                phone
            }

            const organization = await prisma.organization.create({
                data: organizationData,
            });

            const hashedPassword = await bcrypt.hash(password, 10);
            const otp = generateOtp();

            let profilePictureUrl: string | null = null;
            if (req.file) {
                profilePictureUrl = await uploadImageToS3(req.file);
            }

            await prisma.user.create({
                data: {
                    email,
                    fullName,
                    role: UserRoles.ADMIN,
                    orgId: organization.id,
                    password: hashedPassword,
                    otpCode: otp.code,
                    otpExpiresAt: otp.expiresAt,
                    profilePicture: profilePictureUrl,
                },
            });

            await sendOtpEmail(email, otp.code);
            res.status(201).json({code: 201, message: "User registered. Please verify your email with OTP." });
        } catch (error:any) {
           
            res.status(500).json({ code:500,message: "An unexpected server error occurred. Please try again later", error:error.message});
        }
    });
};

export const verifyOtp = async (req: Request, res: Response): Promise<any> => {
    const { email, otp } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ code:404,message: 'User not found' });

        if (!user.otpCode || user.otpCode !== otp) {
            return res.status(401).json({ code:401,message: 'Incorrect OTP' });
        }

        if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
            return res.status(410).json({ code:410,message: 'OTP  expired' });
        }

        await prisma.user.update({
            where: { email },
            data: { verified: true, otpCode: null, otpExpiresAt: null }
        });

        res.status(202).json({ code:202,message: 'Email verification successful' });
    } catch (error) {
        res.status(500).json({ code:500,message: 'Server error' });
    }
};

export const forgetPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({code:400, message: "Email is required" });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (!existingUser) {
            return res.status(404).json({code:404, message: "User not found" });
        }

        const tokenData = generateRandomToken(32, 3600);

        const resetPasswordLink = `${process.env.FRONTEND_URL}/reset-password?token=${tokenData.token}&email=${email}`;
        await sendResetPasswordEmail(email, existingUser.fullName, resetPasswordLink);

        await prisma.user.update({
            where: { email },
            data: { resetToken: tokenData.token, resetTokenExpires: tokenData.expiresAt },
        });

        res.status(202).json({ code: 202, message: "Password reset email sent successfully" });
    } catch (err) {
       
        res.status(500).json({ code: 500,message: "Error activating account" });
    }
}

export const resetPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { token, password, email } = req.body;

        if (!token || !password || !email) {
            return res.status(400).json({ code:400,message: "Token, password and email are required" });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({code:404, message: "User not found" });
        }

        if (!user.resetToken || user.resetToken !== token)
            return res.status(403).json({ code:403,message: "Invalid or expired token" });

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword, resetToken: null, resetTokenExpires: null },
        });

        res.status(200).json({ code: 200, message: "Password changed successfully" });

    } catch (err) {
      
        res.status(500).json({ code:500,message: "Something went wrong" });
    }
};

export const changePassword = async (req: Request, res: Response): Promise<any> => {
    const { email, existingPassword, newPassword } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ code:404,message: 'User not found' });

        const isPasswordValid = await bcrypt.compare(existingPassword, user.password);
        if (!isPasswordValid) {
            return res.status(403).json({code:403, message: 'Existing password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        res.status(200).json({code:200, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ code:500,message: 'Server error' });
    }
};

export const login = async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return res.status(404).json({code:404, message: 'User not found' });

        if (!user.verified) {
            return res.status(403).json({ code:403,message: 'Email verification required' });
        }

        const isUserValid = await bcrypt.compare(password, user.password)

        if (!isUserValid) {
            return res.status(401).json({ code:401,message: 'Incorrect email or password' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

        await prisma.access_token.create({
            data: {
                user_id: user.id,
                active: 1,
                expiry_datetime: new Date(Date.now() + 3600 * 1000),
                token,
            },
        });

        res.status(200).json({ code:200,token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const logout = async (req: Request, res: Response): Promise<any> => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ code:401,message: 'Unauthorized: No token provided' });
    }

    try {
        await prisma.access_token.updateMany({
            where: { token },
            data: { active: 0 },
        });

        res.status(200).json({ code:200,message: 'User logged out successfully' });
    } catch (error) {
        res.status(500).json({ code:500,message: 'Server error' });
    }
};

export const activateAccount = async (req: Request, res: Response): Promise<any> => {
    try {
        const { token, password, email } = req.body;

        if (!token || !password || !email) {
            return res.status(400).json({code:400, message: "Missing required fields: token, password, and email" });
        }

        const agent = await prisma.user.findUnique({ where: { email } });

        if (!agent?.activationToken === token)
            return res.status(400).json({code:400, message: "Invalid or expired token" });

        if (!agent) {
            return res.status(404).json({ code:404,message: "Agent not found" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { email: agent.email },
            data: { password: hashedPassword, activationToken: null, activationTokenExpires: null, verified: true },
        });

        res.status(200).json({ code:200,message: "Account activated successfully" });
    } catch (err) {
        res.status(500).json({code:500, message: "Error activating account" });
    }
};


