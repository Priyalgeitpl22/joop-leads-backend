import { Router } from "express";
import { verify } from "../middlewares/authMiddleware";
import { addSenderAccount, getSenderAccounts, getSenderAccountById, updateSenderAccount, deleteSenderAccount } from "../controllers/sender.accounts.controller";

const router = Router();

router.post("/", verify, addSenderAccount);
router.get("/", verify, getSenderAccounts);
router.get("/:id", verify, getSenderAccountById);
router.put("/:id", verify, updateSenderAccount);
router.delete("/:id", verify, deleteSenderAccount);

export default router;