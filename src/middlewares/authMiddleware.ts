import { PrismaClient } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    const access_token = await prisma.access_token.findFirst({
      where: { token, active: 1 }
    });

    if (!access_token) throw new Error;
  
    const user = await prisma.user.findUnique({ where: { id: access_token.user_id as string },
    select: { email: true, fullName: true, role: true, orgId: true, profilePicture: true} });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profilePictureBase64 = null;
    if (user.profilePicture) {
      const filePath = path.join(__dirname, "../../", user.profilePicture);
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath);
        profilePictureBase64 = `data:image/png;base64,${fileData.toString("base64")}`;
      }
    }

    (req as any).user = { ...user, profilePicture: profilePictureBase64 };

    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
