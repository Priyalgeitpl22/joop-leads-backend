import { Request, Response } from 'express';
import { BillingPeriod, PlanCode } from '@prisma/client';
import { Router } from 'express';
import { assignPlan, getCurrentPlan } from '../controllers/organization.plan.controller';

const router = Router();

function validateAssignPlanBody(req: Request, res: Response, next: Function) {
  const { planCode, billingPeriod } = req.body;
  const allowedPlans: PlanCode[] = ['FREE', 'SILVER', 'GOLD', 'PLATINUM'];
  const allowedPeriods: BillingPeriod[] = ['MONTHLY', 'YEARLY', 'CUSTOM'];

  if (!planCode || !allowedPlans.includes(planCode as PlanCode)) {
    return res.status(400).json({ message: 'Invalid planCode' });
  }
  if (billingPeriod && !allowedPeriods.includes(billingPeriod as BillingPeriod)) {
    return res.status(400).json({ message: 'Invalid billingPeriod' });
  }
  next();
}

router.post('/:orgId/plan/assign', assignPlan);
router.get('/:orgId/plan/current', getCurrentPlan);

export default router;
