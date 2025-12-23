import { Router } from "express";
import { assignPlan, contactSales, getCurrentPlan } from "../controllers/organization.plan.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

router.post("/:orgId/plan/assign", verify, assignPlan);
router.get("/:orgId/plan/current", verify, getCurrentPlan);
router.post("/contact-sales", verify, contactSales);

export default router;
