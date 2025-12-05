import { Request, Response } from "express";
import { PlanCode, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const assignPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { orgId } = req.params;
    const { planCode, billingPeriod } = req.body;

    if (!orgId || !planCode || !billingPeriod) {
      return res.status(400).json({ code: 400, message: 'All fields (orgId, planCode, billingPeriod) are required' });
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode as PlanCode } });
    if (!plan) {
      return res.status(400).json({ code: 400, message: 'Plan not found' });
    }

    const organizationPlan = await prisma.organizationPlan.create({
      data: { orgId, planId: plan.id, billingPeriod }
    });

    res.status(200).json({ code: 200, message: 'Plan assigned successfully', data: organizationPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to assign plan successfully' });
  }
};

export const getCurrentPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { orgId } = req.params;
    const currentPlan = await prisma.organizationPlan.findFirst({ where: { orgId } });
    if (!currentPlan) {
      return res.status(400).json({ code: 400, message: 'No plan assigned to this organization' });
    }
    res.status(200).json({ code: 200, message: 'Current plan fetched successfully', data: currentPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to get current plan' });
  }
};