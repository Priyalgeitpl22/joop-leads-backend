import { Request, Response, NextFunction } from 'express';
import { PlanCode, PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function enforceEmailVerificationLimits(amount: number, orgId: string): Promise<{ code: number; success: boolean; message?: string }> {
  try {

    const orgPlan = await prisma.organizationPlan.findFirst({ where: { orgId, isActive: true }, include: { plan: true } });
    if (!orgPlan || orgPlan.plan.code === PlanCode.FREE) {
      return { code: 402, success: false, message: 'Email verification feature is not available on your plan. Please upgrade to a paid plan to use this feature.' };
    }

    const orgAddOn = await prisma.organizationAddOn.findFirst({ where: { orgId, addOnId: 1, isActive: true }, include: { addOn: true } });
    if (!orgAddOn) {
      return { code: 402, success: false, message: 'Email verification add-on not found' };
    }

    const used = Number(orgAddOn.usedThisPeriod ?? 0);
    const limit = Number(orgAddOn.addOn.emailVerificationLimit ?? 0);
    const remaining = limit - used;

    console.log('Email verification credits left:', remaining);
    if (remaining < amount) {
      return {
        code: 402,
        success: false,
        message: remaining <= 0
          ? 'Email verification limit reached. You have no credits remaining. Please upgrade your plan or wait for the next billing period.'
          : `Email verification limit reached. You requested ${amount} verification(s) but only ${remaining} credit(s) remaining. Please upgrade or wait for the next billing period.`,
      };
    }
    return { code: 200, success: true, message: 'Email verification limits enforced successfully' };

  } catch (error) {
    console.error('Enforce email verification limits error:', error);
    return { code: 500, success: false, message: 'Failed to enforce email verification limits' };
  }
}