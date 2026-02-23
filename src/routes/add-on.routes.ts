import { Router } from "express";
import {
  getAllAddOns,
  getAddOnById,
  getAddOnByCode,
  createAddOn,
  updateAddOn,
  deleteAddOn,
  getAddOnPlans,
  setAddOnPlans,
} from "../controllers/add-on.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

// List all add-ons (public or protected - using verify for consistency)
router.get("/", getAllAddOns);

// Get by code (must be before /:id)
router.get("/code/:code", getAddOnByCode);

// Plan links for an add-on
router.get("/:id/plans", getAddOnPlans);
router.put("/:id/plans", verify, setAddOnPlans);

// CRUD by id
router.get("/:id", getAddOnById);
router.post("/", verify, createAddOn);
router.put("/:id", verify, updateAddOn);
router.delete("/:id", verify, deleteAddOn);

export default router;
