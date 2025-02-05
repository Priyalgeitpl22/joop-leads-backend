import { PrismaClient } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
  
    const user = await prisma.user.findUnique({ where: { id: access_token.user_id as string } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    (req as any).user = user;

    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
