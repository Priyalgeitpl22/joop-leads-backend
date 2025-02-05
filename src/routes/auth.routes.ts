import { Router } from "express";
import { register, verifyOtp, resetPassword, changePassword, login, logout } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/change-password", authMiddleware, changePassword);
router.post("/login", login);
router.post("/logout", logout);

export default router;
