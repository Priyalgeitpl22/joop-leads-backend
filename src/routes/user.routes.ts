import { Router } from "express";
import { register, verifyOtp, resetPassword, changePassword, login } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { createUser, deleteUser, getAuthUser, getUsers, searchUser, updateUser } from "../controllers/user.controller";

const router = Router();

router.get("/", authMiddleware, getAuthUser);
router.get("/users",authMiddleware, getUsers);
router.put("/", updateUser);
router.post('/create-user',authMiddleware,createUser)
router.delete('/:user_id',deleteUser)
router.get('/search-user',searchUser)

export default router;
