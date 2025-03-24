import { PrismaClient, User } from "@prisma/client";
import { Request, Response } from "express";
import { deleteImageFromS3, getPresignedUrl, uploadImageToS3 } from "../aws/imageUtils";
import multer from "multer";
import { generateOtp, generateRandomToken } from "../utils/otp.utils";
import { UserRoles } from "../enums";
import { sendResetPasswordEmail } from "../utils/email.utils";

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() }).single("profilePicture");


interface AuthenticatedRequest extends Request {
  user?: User;
}


export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: "Organization ID not found" });
    }
    console.log("user", user?.orgId);

    const users = await prisma.user.findMany({
      where: {
        orgId: user?.orgId,
      },
    });

    const organization = await prisma.organization.findUnique({
      where: {
        id: user?.orgId, 
      },
    });

    if (!organization) {
     res.status(404).json({ code: 404, message: "Organization not found" });
    }
    if (users.length > 0) {
      for (const user of users) {
        if (user.profilePicture) {
          user.profilePicture = await getPresignedUrl(user.profilePicture);
        }
      }
    }
    const message=users?`User fetched  from ${organization?.name}` :"Users not found"
    res.status(200).json({ code: 200, message: message,data: users});
  } catch (err) {
    res.status(500).json({ code: 500, message: "Error fetching users" });
  }
};

export const getAuthUser = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;

  if (user && user.profilePicture) {
    user.profilePicture = await getPresignedUrl(user.profilePicture);
  }
  res.status(200).json({
    user: user,
    message: "User details fetched successfully",
    code: 200
  });
};

export const updateUser = async (req: Request, res: Response): Promise<any> => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ code: 400, message: "Error uploading file", error: err.message });
      }

      const { id, name, email, role } = req.body;

      if (!id) {
        return res.status(400).json({ code: 400, message: "User ID is required." });
      }

      const existingUser = await prisma.user.findUnique({ where: { id } });

      if (!existingUser) {
        return res.status(404).json({ code: 404, message: "User not found" });
      }

      let profilePictureUrl: string | null = existingUser.profilePicture;
      if (req.file) {
        profilePictureUrl = await uploadImageToS3(req.file);
        
        if(existingUser.profilePicture)
        await deleteImageFromS3(existingUser.profilePicture);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          fullName: name || existingUser.fullName,
          email: email || existingUser.email,
          role: role || existingUser.role,
          profilePicture: profilePictureUrl,
        },
        select: { id: true, fullName: true, email: true, role: true, profilePicture: true },
      });

      res.status(200).json({
        user: {...updatedUser, profilePicture: updatedUser.profilePicture ? await getPresignedUrl(updatedUser.profilePicture) : null},
        message: "User details updated successfully",
        code: 200,
      });
    });

  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ code: 500, message: "Error updating user" });
  }
};

export const createUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  upload(req, res, async (err) => {
    if (err) {
      return res
        .status(400)
        .json({ code: 400, message: "File upload failed", error: err });
    }
    const user = req.user;
    if (!user?.orgId) {
      return res.status(400).json({ code: 400, message: "Organization ID is required to create a campaign." });
    }
    const { email, fullName, phone, role } = req.body;

    if (!email || !fullName) {
      return res
        .status(400)
        .json({ code: 400, message: "All fields are required." });
    }
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res
          .status(400)
          .json({ code: 400, message: "Email already exists" });
      }

      let profilePictureUrl: string | null = null;
      if (req.file) {
        profilePictureUrl = await uploadImageToS3(req.file);
      }
     
      const newUser = await prisma.user.create({
        data: {
          email,
          fullName,
          role: role || UserRoles.AGENT,
          orgId: user?.orgId,
          phone,
          password:"",
          profilePicture: profilePictureUrl,
        },
      });
      const tokenData = generateRandomToken(32, 3600);

      const resetPasswordLink = `${process.env.FRONTEND_URL}/activate-account?token=${tokenData.token}&email=${email}`;
      await sendResetPasswordEmail(email, newUser?.fullName, resetPasswordLink);

      await prisma.user.update({
        where: { email },
        data: {
          resetToken: tokenData.token,
          resetTokenExpires: tokenData.expiresAt,
        },
      });
      res.status(201).json({
        code: 201,
        message: "User created successfully",
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: "An unexpected server error occurred. Please try again later",
        error: error.message,
      });
    }
  });
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const {user_id} = req.params

    if (!user_id) {
      return res
        .status(400)
        .json({ code: 400, message: "user_id is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!user) {
      return res.status(404).json({ code: 404, message: "User not found" });
    }

    await prisma.user.delete({
      where: { id: user_id },
    });

    return res
      .status(200)
      .json({ code: 200, message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return res
      .status(500)
      .json({
        code: 500,
        message: "Error deleting user",
        details: error.message,
      });
  }
};

export const searchUser = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { query } = req.query;
    const user = req.user;
    if (!user?.orgId) {
      return res
        .status(400)
        .json({ code: 400, message: "Organization ID is required ." });
    }

    const data = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query as string, mode: "insensitive" } },
          { role: { contains: query as string, mode: "insensitive" } },
          { fullName: { contains: query as string, mode: "insensitive" } },
        ],
        orgId: user?.orgId,
      },
    });
    for (let userData of data) {
      if (userData.profilePicture) {
        userData.profilePicture = await getPresignedUrl(
          userData.profilePicture
        );
      }
    }

    if (data.length === 0) {
      return res.status(404).json({ code: 404, message: "No users found." });
    }

    if (!user) {
      return res.status(500).json({ code: 404, message: "User not found " });
    }

    res.status(200).json({
      code: 200,
      data,
      message: data.length > 0 ? "Success" : "No users found",
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ code: 500, message: "Error fetching user" });
  }
};