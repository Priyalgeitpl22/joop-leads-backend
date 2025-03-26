import { authMiddleware } from './../middlewares/authMiddleware';
import { Router } from "express";
import { createFolder, deleteFolder, folderList, updateFolder, } from "../controllers/folder.controller";

const router = Router();

router.post("/",authMiddleware,createFolder);
router.get("/",authMiddleware,folderList);
router.put("/:id",authMiddleware,updateFolder);
router.delete("/:id",authMiddleware,deleteFolder);

export default router;
