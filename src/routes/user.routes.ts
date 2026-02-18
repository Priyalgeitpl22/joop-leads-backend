import { Router } from "express";
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, getAuthUser, softDeleteUser } from "../controllers/user.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

router.get("/all", getAllUsers);
router.get("/", getAuthUser);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.delete("/soft-delete/:id", verify, softDeleteUser);

export default router;
