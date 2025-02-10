import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { getPresignedUrl } from "../aws/imageUtils";

const prisma = new PrismaClient();

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    if (users.length > 0) {
      for (const user of users) {
        if (user.profilePicture) {
          user.profilePicture = await getPresignedUrl(user.profilePicture);
        }
      }
    }
    res.status(200).json({ code: 200, data: users, message: "success" });
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
