import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export const getAllThreads = async (req: Request, res: Response) => {
    try {
        const threads = await prisma.thread.findMany();
        res.status(200).json({ code: 200, data: threads, message: "success" });
    } catch (err) {
        res.status(500).json({ code: 500, message: "Error fetching threads" });
    }
};

