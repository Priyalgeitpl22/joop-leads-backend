import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { getAllThreads } from "../controllers/thread.controller";

const router = Router();

router.get("/", getAllThreads);

export default router;
