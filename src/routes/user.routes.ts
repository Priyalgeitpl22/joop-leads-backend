import { Router } from "express";
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, getAuthUser, deleteUserById } from "../controllers/user.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

router.get("/all", getAllUsers);
router.get("/", getAuthUser);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.delete("/delete/:id", verify, deleteUserById);

export default router;
