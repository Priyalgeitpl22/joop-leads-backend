import { Request, Response } from "express";
import { OrganizationPlanService, assignFreePlanToOrg } from "../services/organization.plan.service";

export { assignFreePlanToOrg };

export const assignPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgId } = req.params;
    const { planCode, billingPeriod } = req.body;
    const response = await OrganizationPlanService.assignPlan(orgId, planCode, billingPeriod);
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to assign plan" });
  }
};

export const getCurrentPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgId } = req.params;
    const response = await OrganizationPlanService.getCurrentPlan(orgId);
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to get current plan" });
  }
};

export const contactSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { planCode, billingPeriod, addOns, totalCost } = req.body;

    if (!user) {
      res.status(401).json({ code: 401, message: "Unauthorized" });
      return;
    }

    const response = await OrganizationPlanService.contactSales(
      { orgId: user.orgId, email: user.email, role: user.role },
      planCode,
      addOns,
      billingPeriod,
      totalCost
    );
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to contact sales" });
  }
};
