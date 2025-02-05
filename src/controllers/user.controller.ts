import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json({ code: 200, data: users, message: "success" });
  } catch (err) {
    res.status(500).json({ code: 500, message: "Error fetching users" });
  }
};

export const getAuthUser = (req: Request, res: Response): void => {
  const user = (req as any).user;

  res.status(200).json({
    user: user,
    message: "User details fetched successfully",
    code: 200
  });
};
