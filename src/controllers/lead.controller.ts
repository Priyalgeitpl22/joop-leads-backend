import { Request, Response } from "express";
import { LeadService } from "../services/lead.service";

export const getLeadById = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await LeadService.getById(req.params.id, req.user.orgId);
    if (!lead) {
      res.status(404).json({ code: 404, message: "Lead not found" });
      return;
    }
    res.json({ code: 200, data: lead });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch lead" });
  }
};

export const getAllLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const leads = await LeadService.getAll(req.user.orgId);
    res.json({ code: 200, data: leads });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch leads" });
  }
};

export const createLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await LeadService.create({ ...req.body, orgId: req.user.orgId });
    res.status(201).json({ code: 201, data: lead });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e.message });
  }
};

export const updateLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await LeadService.update(req.params.id, req.user.orgId, req.body);
    res.json({ code: 200, data: lead });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e.message });
  }
};

export const deleteLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await LeadService.deleteMany(req.body.leadIds);
    res.json({ code: 200, message: `${result.count} lead(s) deleted` });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to delete leads" });
  }
};

export const searchLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const leads = await LeadService.search(req.user.orgId, String(req.query.q || ""));
    res.json({ code: 200, data: leads });
  } catch {
    res.status(500).json({ code: 500, message: "Search failed" });
  }
};

export const filterLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const leads = await LeadService.filter(req.user.orgId, req.query);
    res.json({ code: 200, data: leads });
  } catch {
    res.status(500).json({ code: 500, message: "Filter failed" });
  }
};

export const unsubscribeLead = async (req: Request, res: Response): Promise<void> => {
  try {
    await LeadService.unsubscribe(req.body.email);
    res.json({ code: 200, message: "Lead unsubscribed successfully" });
  } catch {
    res.status(500).json({ code: 500, message: "Unsubscribe failed" });
  }
};
