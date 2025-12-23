import { Router } from "express";
import { getOrganization, saveOrganization, updateOrganization } from "../controllers/organization.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

router.get("/", verify, getOrganization);
router.post("/", verify, saveOrganization);
router.put("/", verify, updateOrganization);

export default router;
