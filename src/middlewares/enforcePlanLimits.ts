import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function enforcePlanLimits(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = (req as any).user.orgId;

    const subscription = await prisma.organizationPlan.findFirst({
      where: { orgId, isActive: true },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      return res.status(403).json({ message: 'No active plan assigned' });
    }

    const plan = subscription.plan;

    if (plan.maxLiveCampaigns !== null) {
      const liveCampaignCount = await prisma.campaign.count({
        where: {
          orgId,
          status: 'ACTIVE',
        },
      });

      if (liveCampaignCount >= plan.maxLiveCampaigns) {
        return res.status(403).json({
          message: `Plan limit reached: ${plan.maxLiveCampaigns} active campaign(s) allowed on ${plan.name} plan.`,
          code: 'PLAN_LIMIT_CAMPAIGNS',
        });
      }
    }

    // Example: Check for email sending limit
    if (plan.maxEmailsPerMonth !== null) {
      if (subscription.emailsSentThisPeriod >= plan.maxEmailsPerMonth) {
        return res.status(403).json({
          message: `Plan limit reached: ${plan.maxEmailsPerMonth} emails/month on ${plan.name} plan.`,
          code: 'PLAN_LIMIT_EMAILS',
        });
      }
    }

    (req as any).activePlan = plan;
    (req as any).activeSubscription = subscription;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to enforce plan limits' });
  }
}
