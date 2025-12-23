import { Router } from "express";
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, getAuthUser } from "../controllers/user.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

router.get("/", verify, getAuthUser);
router.get("/all", verify, getAllUsers);
router.get("/:id", verify, getUserById);
router.post("/", verify, createUser);
router.put("/:id", verify, updateUser);
router.delete("/:id", verify, deleteUser);

export default router;
