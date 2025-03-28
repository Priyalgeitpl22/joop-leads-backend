import { authMiddleware } from './../middlewares/authMiddleware';
import { Router } from "express";
import { createFolder, deleteFolder, folderList, getFolderById, updateFolder, } from "../controllers/folder.controller";

const router = Router(); 
router.get('/',authMiddleware,getFolderById)
router.post("/",authMiddleware,createFolder);
router.get("/",authMiddleware,folderList);
router.put("/:id",authMiddleware,updateFolder);
router.delete("/:id",authMiddleware,deleteFolder);


export default router;
