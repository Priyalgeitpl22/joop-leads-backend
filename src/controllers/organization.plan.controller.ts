import { Request, Response } from "express";
import { OrganizationPlanService } from "../services/organization.plan.service";
import * as OrganizationAddOnService from "../services/organization.addon.service";

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

export const assignFreePlanToAllOrgs = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await OrganizationPlanService.assignFreePlanToAllOrgs();
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to assign free plan to all organizations" });
  }
};

export const activatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planCode, orgId, billingPeriod } = req.body;
    const response = await OrganizationPlanService.activatePlan(orgId, planCode, billingPeriod);
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to activate plan" });
  }
};

// --- Add-on (org-level) ---

export const assignAddOn = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.orgId ?? (req.user as any)?.orgId;
    const { addOnCode, limitOverride } = req.body;
    if (!orgId || !addOnCode) {
      res.status(400).json({ code: 400, message: "orgId and addOnCode are required" });
      return;
    }
    const response = await OrganizationAddOnService.assignAddOnToOrg(orgId, addOnCode, { limitOverride });
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to assign add-on" });
  }
};

export const getOrgAddOns = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.orgId ?? (req.user as any)?.orgId;
    if (!orgId) {
      res.status(400).json({ code: 400, message: "orgId is required" });
      return;
    }
    const response = await OrganizationAddOnService.getOrgAddOns(orgId);
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to get add-ons" });
  }
};

export const getAddOnsAvailableForPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.orgId ?? (req.user as any)?.orgId;
    if (!orgId) {
      res.status(400).json({ code: 400, message: "orgId is required" });
      return;
    }
    const response = await OrganizationAddOnService.getAddOnsAvailableForCurrentPlan(orgId);
    res.status(response.code).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Failed to get available add-ons" });
  }
};
