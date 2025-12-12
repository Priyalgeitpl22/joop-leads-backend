import { Request, Response } from "express";
import { PlanCode, PrismaClient } from "@prisma/client";
import { subscriptionActivationEmail } from "../utils/email.utils";
import { UserRoles } from "../enums";

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

    const now = new Date();
    const endsAt = billingPeriod === 'YEARLY' 
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : billingPeriod === 'MONTHLY'
        ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
        : null;

    // Check if organization already has a plan
    const existingPlan = await prisma.organizationPlan.findFirst({
      where: { orgId }
    });

    let organizationPlan;
    if (existingPlan) {
      // Update existing plan
      organizationPlan = await prisma.organizationPlan.update({
        where: { id: existingPlan.id },
        data: {
          planId: plan.id,
          billingPeriod,
          isActive: true,
          startsAt: now,
          endsAt,
          emailsSentThisPeriod: 0,
          leadsAddedThisPeriod: 0,
          senderAccountsInUse: 0
        }
      });
    } else {
      // Create new plan
      organizationPlan = await prisma.organizationPlan.create({
        data: {
          orgId,
          planId: plan.id,
          billingPeriod,
          isActive: true,
          startsAt: now,
          endsAt,
          emailsSentThisPeriod: 0,
          leadsAddedThisPeriod: 0,
          senderAccountsInUse: 0
        }
      });
    }

    res.status(200).json({ code: 200, message: 'Plan assigned successfully', data: organizationPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to assign plan successfully' });
  }
};

export const getCurrentPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { orgId } = req.params;

    const currentPlan = await prisma.organizationPlan.findFirst({ where: { orgId }, include: { plan: true } });
    
    if (!currentPlan) {
      return res.status(400).json({ code: 400, message: 'No plan assigned to this organization' });
    }
    res.status(200).json({ code: 200, message: 'Current plan fetched successfully', data: {planCode: currentPlan.plan.code, ...currentPlan.plan, ...currentPlan} });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to get current plan' });
  }
};

export const contactSales = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    const { planCode, billingPeriod } = req.body;
    
    if (!user) {
      return res.status(401).json({ code: 401, message: 'Unauthorized' });
    }

    if (user.role !== UserRoles.ADMIN) {
      return res.status(401).json({ code: 401, message: 'Only admin can change the subscription plan' });
    }
    if (!planCode || !billingPeriod) {
      return res.status(400).json({ code: 400, message: 'All fields (orgId, planCode, billingPeriod) are required' });
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode as PlanCode } });
    const organization = await prisma.organization.findUnique({ where: { id: user.orgId } });

    if (!organization) {
      return res.status(400).json({ code: 400, message: 'Organization not found' });
    }

    if (!plan) {
      return res.status(400).json({ code: 400, message: 'Plan not found' });
    }

    await subscriptionActivationEmail(planCode, billingPeriod, organization.name || '', user?.email || '');

    const existingPlan = await prisma.organizationPlan.findFirst({
      where: { orgId: user.orgId }
    });

    if (existingPlan) {
      await prisma.organizationPlan.update({
        where: { id: existingPlan.id },
        data: { planId: plan.id, billingPeriod, isActive: false }
      });
    } else {
      await prisma.organizationPlan.create({
        data: { orgId: user.orgId, planId: plan.id, billingPeriod, isActive: false }
      });
    }

    return res.status(200).json({ code: 200, message: 'Email sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to contact sales' });
  }
};