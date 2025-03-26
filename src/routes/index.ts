import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import organizationRoutes from "./organization.routes";
import { authMiddleware } from "../middlewares/authMiddleware";
import emailCampaignRoutes from './email.campaign.routes'
import contactRoutes from "./contact.routes";
import trackingRoutes from "./tracking.routes";
import folderRoutes from "./folder.routes"

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", authMiddleware, userRoutes);
router.use("/org", authMiddleware, organizationRoutes);
router.use("/email-campaign", emailCampaignRoutes)
router.use('/contact', contactRoutes);
router.use('/track', trackingRoutes);
router.use('/folder', folderRoutes);


export default router;
