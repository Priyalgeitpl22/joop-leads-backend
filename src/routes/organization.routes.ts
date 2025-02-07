import { Router } from "express";
import { getOrganizationDetails, saveOrganizationDetails } from "../controllers/organization.controller"
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", saveOrganizationDetails);
router.get("/", getOrganizationDetails);

export default router;
