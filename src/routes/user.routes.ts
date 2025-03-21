import { Router } from "express";
import { register, verifyOtp, resetPassword, changePassword, login } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { createUser, getAuthUser, getUsers, updateUser } from "../controllers/user.controller";

const router = Router();

router.get("/", authMiddleware, getAuthUser);
router.get("/users",authMiddleware, getUsers);
router.put("/", updateUser);
router.post('/create-user',authMiddleware,createUser)

export default router;
