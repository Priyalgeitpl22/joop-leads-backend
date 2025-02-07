import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const saveOrganizationDetails = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, domain, country, phone } = req.body;

    if (!name || !domain || !country || !phone) {
      return res.status(400).json({
        code: 400,
        message: "All fields (name, domain, country, phone) are required."
      });
    }

    const organization = await prisma.organization.create({
      data: { name, domain, country, phone}
    });

    res.status(200).json({
      code: 200,
      data: organization,
      message: "Organization created successfully"
    });
    
  } catch (err) {
    console.error('Error saving organization:', err);
    res.status(500).json({
      code: 500,
      message: "Error saving organization"
    });
  }
};

export const getOrganizationDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      res.status(400).json({ code: 400, message: "Organization ID is required" });
    }

    const organization = await prisma.organization.findFirst({
      where: { id: orgId as string }
    });

    if (!organization) {
      res.status(404).json({ code: 404, message: "Organization not found" });
    }

    res.status(200).json({
      data: organization,
      message: "Organization details fetched successfully",
      code: 200
    });

  } catch (err) {
    console.error("Error fetching organization details:", err);
    res.status(500).json({ code: 500, message: "Error fetching organization details" });
  }
};