import { Router } from "express";
import {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLeads,
  searchLeads,
  filterLeads,
  unsubscribeLead,
} from "../controllers/lead.controller";
import { verify } from "../middlewares/authMiddleware";

const router = Router();

// Static routes first
router.get("/search", verify, searchLeads);
router.get("/filter", verify, filterLeads);
router.post("/unsubscribe", unsubscribeLead);

// CRUD routes
router.get("/", verify, getAllLeads);
router.post("/", verify, createLead);
router.delete("/", verify, deleteLeads);

// Parameterized routes last
router.get("/:id", verify, getLeadById);
router.put("/:id", verify, updateLead);

// router.post("/bulk-delete", verify, bulkDeleteLeads);

export default router;
