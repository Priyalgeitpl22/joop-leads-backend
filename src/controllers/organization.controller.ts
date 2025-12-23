import { Request, Response } from "express";
import { OrganizationService } from "../services/organisation.service";

/* -------------------- Get organization -------------------- */
export const getOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await OrganizationService.getById(req.user.orgId);
    if (!org) {
      res.status(404).json({ code: 404, message: "Organization not found" });
      return;
    }

    res.json({ code: 200, data: org });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch organization" });
  }
};

/* -------------------- Save organization -------------------- */
export const saveOrganization = async (req: Request, res: Response) => {
  try {
    const org = await OrganizationService.create(req.body);
    res.status(201).json({ code: 201, data: org });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e.message });
  }
};

/* -------------------- Update organization -------------------- */
export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await OrganizationService.update(req.user.orgId, req.body);
    res.json({ code: 200, data: org });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e.message || "Update failed" });
  }
};
