import { Request, Response } from 'express';
import { PrismaClient, PlanCode } from '@prisma/client';

const prisma = new PrismaClient();

export const getPlans = async (req: Request, res: Response): Promise<any> => {
  try {
    const plans = await prisma.plan.findMany();
    res.status(200).json({ code: 200, message: 'Plans fetched successfully', data: plans });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to fetch plans successfully' });
  }
};

export const getPlanByCode = async (req: Request, res: Response): Promise<any> => {
  try {
    const { code } = req.params;
    const plan = await prisma.plan.findUnique({ where: { code: code as PlanCode } });
    res.status(200).json({ code: 200, message: 'Plan fetched successfully', data: plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to fetch plan' });
  }
};