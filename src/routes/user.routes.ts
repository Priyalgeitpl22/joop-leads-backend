import { Router } from "express";
import { register, verifyOtp, resetPassword, changePassword, login } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { getAuthUser, getUsers, updateUser } from "../controllers/user.controller";

const router = Router();

router.get("/", authMiddleware, getAuthUser);
router.get("/users",authMiddleware, getUsers);
router.put("/", updateUser);

export default router;
