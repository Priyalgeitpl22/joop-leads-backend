import { Router } from "express";
import { register, verifyOtp, resetPassword, changePassword, login, logout, activateAccount } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/change-password", authMiddleware, changePassword);
router.post("/login", login);
router.post("/logout", logout);
router.post("/activate", activateAccount);

export default router;
