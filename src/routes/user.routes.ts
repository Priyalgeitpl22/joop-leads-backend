import { Router } from "express";
import { register, verifyOtp, resetPassword, changePassword, login } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { getAuthUser, getUsers } from "../controllers/user.controller";

const router = Router();

router.get("/", authMiddleware, getAuthUser);
router.get("/users", authMiddleware, getUsers);

export default router;
