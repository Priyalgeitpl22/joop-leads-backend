import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { createUser, deleteUser, filterUsers, getAuthUser, getUsers, searchUser, updateUser } from "../controllers/user.controller";

const router = Router();

router.get('/filter', authMiddleware, filterUsers)
router.get("/search-user", authMiddleware, searchUser);
router.get("/", authMiddleware, getAuthUser);
router.get("/users", authMiddleware, getUsers);
router.put("/", updateUser);
router.post('/create-user', authMiddleware, createUser)
router.delete('/:user_id', deleteUser)

export default router;
