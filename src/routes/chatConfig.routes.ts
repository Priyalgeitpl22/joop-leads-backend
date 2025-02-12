import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { getChatConfig, getChatScript, updateChatConfig } from "../controllers/chatConfig.controller";

const router = Router();

router.get("/", getChatConfig);
router.post("/", updateChatConfig);
router.get("/script", getChatScript);

export default router;