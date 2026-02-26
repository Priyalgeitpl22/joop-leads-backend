import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { UserService } from "../services/user.service";
import multer from "multer";
import { getPresignedUrl, uploadImageToS3 } from "../aws/imageUtils";
import { sendActivationEmail } from "../utils/email.utils";
import { generateRandomToken } from "../utils/otp.utils";
import { UserRoles } from "../enums";

const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
}).single("profilePicture");


export const getAuthUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const authUser = await UserService.getById(user.id, user.orgId);

    if (!authUser) {
      res.status(404).json({ code: 404, message: "User not found" });
      return;
    }

    if (authUser.profilePicture) {
      authUser.profilePicture = await getPresignedUrl(authUser.profilePicture);
    }

    res.json({ code: 200, data: authUser });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch user" });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await UserService.getByOrg(req.user.orgId);

    await Promise.all(
      users.map(async (user) => {
        if (user.profilePicture) {
          user.profilePicture = await getPresignedUrl(user.profilePicture);
        }
      })
    );

    res.json({ code: 200, data: users });
  } catch (e) {
    res.status(500).json({ code: 500, message: "Failed to fetch users" });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await UserService.getById(req.params.id as any, req.user.orgId);
    if (!user) {
      res.status(404).json({ code: 404, message: "User not found" });
      return;
    }

    if (user.profilePicture) {
      user.profilePicture = await getPresignedUrl(user.profilePicture);
    }

    res.json({ code: 200, data: user });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch user" });
  }
};

export const createUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user;
    if (!user?.orgId) {
      return res.status(400).json({ code: 400, message: "Organization ID is required to create a user." });
    }

    const { email, fullName, phone, role } = req.body;

    if (!email || !fullName) {
      return res
        .status(400)
        .json({ code: 400, message: "All fields are required." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (existingUser) {
      return res
        .status(400).json({ code: 400, message: "User with this email already exists!" });
    }

    let profilePictureUrl: string | null = null;
    if (req.file) {
      profilePictureUrl = await uploadImageToS3(req.file);
    }

    const tokenData = generateRandomToken(32, 18000);

    const activationLink = `${process.env.FRONTEND_URL}/activate-account?token=${tokenData.token}&email=${email}`;
    await sendActivationEmail(email, fullName, activationLink);

    const newUser = await prisma.user.create({
      data: {
        email,
        fullName,
        role: role || UserRoles.AGENT,
        orgId: user?.orgId,
        phone,
        password: "",
        profilePicture: profilePictureUrl,
        activationToken: tokenData.token,
        activationTokenExpiresAt: tokenData.expiresAt,
      },
    });

    res.status(201).json({
      code: 201,
      data: newUser,
      message: "User created successfully",
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({
      code: 500,
      message: "An unexpected server error occurred. Please try again later",
      error: error.message,
    });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ code: 400, message: `Upload error: ${err.message}` });
      return;
    } else if (err) {
      res.status(400).json({ code: 400, message: err.message });
      return;
    }

    try {
      const updateData: any = { ...req.body };

      if (req.file) {
        const profilePictureKey = await uploadImageToS3(req.file);
        updateData.profilePicture = profilePictureKey;
      }

      if (updateData.removeProfilePicture === 'true') {
        updateData.profilePicture = null;
        delete updateData.removeProfilePicture;
      }

      const user = await UserService.update(req.params.id as any, updateData);

      if (user.profilePicture) {
        const profilePictureUrl = await getPresignedUrl(user.profilePicture);
        console.log(profilePictureUrl);
        user.profilePicture = profilePictureUrl;
      }
      res.json({ code: 200, data: user });
    } catch (error: any) {
      res.status(400).json({ code: 400, message: error.message || "Update failed" });
    }
  });
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await UserService.delete(req.params.id as any);
    res.json({ code: 200, message: "User deleted" });
  } catch (error) {
    res.status(400).json({ code: 400, message: "Delete failed" });
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await UserService.search(
      req.user.orgId,
      String(req.query.q || "")
    );

    await Promise.all(
      users.map(async (user) => {
        if (user.profilePicture) {
          user.profilePicture = await getPresignedUrl(user.profilePicture);
        }
      })
    );

    res.json({ code: 200, data: users });
  } catch {
    res.status(500).json({ code: 500, message: "Search failed" });
  }
};