import { Router } from "express";
import {
  assignPlan,
  contactSales,
  getCurrentPlan,
  assignFreePlanToAllOrgs,
  activatePlan,
  assignAddOn,
  getOrgAddOns,
  getAddOnsAvailableForPlan,
} from "../controllers/organization.plan.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

router.post("/:orgId/plan/assign", verify, assignPlan);
router.get("/:orgId/plan/current", verify, getCurrentPlan);
router.post("/contact-sales", verify, contactSales);
router.post("/assign-free-plan-to-all-orgs", assignFreePlanToAllOrgs);
router.post("/activate", activatePlan);

// Org-level add-ons (e.g. when on Starter and picking add-on)
router.get("/:orgId/add-ons", verify, getOrgAddOns);
router.get("/:orgId/add-ons/available", verify, getAddOnsAvailableForPlan);
router.post("/:orgId/add-ons", verify, assignAddOn);

export default router;
