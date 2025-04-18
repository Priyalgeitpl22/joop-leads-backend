import { Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: User;
}

export const createContact = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404).json({ code: 404, message: "Organization not found" });
    }

    const {
      first_name,
      last_name,
      email,
      phone_number,
      company_name,
      website,
      location,

      file_name,
      blocked = false,
      unsubscribed = false,
      active = true,
    } = req.body;


    if (!user?.orgId || !user?.id) {
      throw new Error("User details are missing. Cannot create contact.");
    }

    const newContact = await prisma.contact.create({
      data: {
        orgId: user.orgId,
        uploadedBy: user.id,
        first_name,
        last_name,
        email,
        phone_number,
        company_name,
        website,
        location,
        file_name,
        blocked: blocked ?? false,
        unsubscribed: unsubscribed ?? false,
        active: active ?? true,
      },
    });

    res.status(201).json({
      code: 201,
      message: "Contact created successfully",
      data: newContact,
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({ code: 500, message: "Error creating contact" });
  }
};

export const getContactsById = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        uploadedUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        emailCampaigns: {
          select: {
            campaign: {
              select: {
                id: true,
                campaignName: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ code: 404, message: "Contact not found" });
    }

    res.status(200).json({
      code: 200,
      message: `Contact fetched with id ${id}`,
      data: {
        ...contact,
      },
    });
  } catch (err) {
    console.error("Error fetching contact:", err);
    res.status(500).json({ code: 500, message: "Error fetching contact" });
  }
};

export const getallContacts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    console.log("user", user);
    if (!user?.orgId) {
      return res.status(400).json({
        code: 400,
        message: "Organization ID is required to create a campaign.",
      });
    }

    const contacts = await prisma.contact.findMany({
      where: {
        orgId: user.orgId
      },
      include: {
        _count: {
          select: { emailCampaigns: true },
        },
        uploadedUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result = contacts.map((contact) => ({
      ...contact,
      uploaded_by: contact.uploadedUser
        ? {
            full_name: contact.uploadedUser.fullName,
          }
        : null,
      used_in_campaigns: contact._count.emailCampaigns,
    }));

    if (!result.length) {
      return res.status(404).json({ code: 404, message: "Contacts not found" });
    }

    res.status(200).json({
      code: 200,
      message: "Contacts fetched successfully",
      data: result,
    });
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ code: 500, message: "Error fetching contacts" });
  }
};
export const updateContact = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404).json({ code: 404, message: "User not found" });
      return;
    }

    const contactId = req.params.id;

    const {
      first_name,
      last_name,
      email,
      phone_number,
      company_name,
      website,
      location,
      file_name,
      blocked,
      unsubscribed,
      active,
    } = req.body;

    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!existingContact) {
      res.status(404).json({ code: 404, message: "Contact not found" });
      return;
    }

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        first_name,
        last_name,
        email,
        phone_number,
        company_name,
        website,
        location,
        file_name,
        blocked,
        unsubscribed,
        active,
      },
    });

    res.status(200).json({
      code: 200,
      message: "Contact updated successfully",
      data: updatedContact,
    });
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({ code: 500, message: "Error updating contact" });
  }
};


export const deactivateContacts = async (req: Request, res: Response) => {
  try {
    const { contactIds } = req.body;

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, active: true },
    });

    if (contacts.length === 0) {
      res
        .status(404)
        .json({ code: 404, message: "No matching contacts found" });
    }

    const updatedContacts = await Promise.all(
      contacts.map((contact) =>
        prisma.contact.update({
          where: { id: contact.id },
          data: { active: !contact.active },
          select: { id: true, active: true },
        })
      )
    );

    const message = updatedContacts.every((contact) => contact.active)
      ? "Accounts activated successfully"
      : "Accounts deactivated successfully";

    res.status(200).json({
      code: 200,
      message,
      data: updatedContacts,
    });
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ code: 500, message: "Error fetching contacts" });
  }
};
export const searchContacts = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { query } = req.query;
    const user = req.user;

    const data = await prisma.contact.findMany({
      where: {
        OR: [
          { email: { contains: query as string, mode: "insensitive" } },
          { first_name: { contains: query as string, mode: "insensitive" } },
          { last_name: { contains: query as string, mode: "insensitive" } },
        ],
        orgId: user?.orgId,
      },
    });

    res.status(200).json({
      code: 200,
      data,
      message: data.length > 0 ? "Success" : "No contacts found",
    });
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ code: 500, message: "Error fetching contacts" });
  }
};

export const createCampaignWithContacts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    console.log("req.user", req.user);
    if (!user?.orgId) {
      return res.status(400).json({
        code: 400,
        message: "Organization ID is required to create a campaign.",
      });
    }

    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: "At least one contact ID must be provided",
      });
    }

    const existingContacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        orgId: user.orgId,
      },
      select: { id: true },
    });

    if (existingContacts.length !== contactIds.length) {
      return res.status(400).json({
        code: 400,
        message:
          "Some contacts do not exist or do not belong to your organization",
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        orgId: user.orgId,
        campaignName: "Untitled Campaign",
        status: "DRAFT",
      },
    });

    const emailCampaignRecords = contactIds.map((contactId) => ({
      contactId,
      campaignId: campaign.id,
    }));

    await prisma.emailCampaign.createMany({
      data: emailCampaignRecords,
    });

    return res.status(201).json({
      message: "Campaign created successfully with selected contacts",
      campaignId: campaign.id,
      associatedContacts: existingContacts.map((c) => c.id),
      code: 201,
    });
  } catch (error: any) {
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const deleteContact = async (req: Request, res: Response) => {
  try {
    const contactIds = req.body.contactIds as string[];
    const contact = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
      },
    });
    if (contact.length == 0) {
     res.status(404).json({ code: 404, message: "Contacts not found" });
    }
    const deletedContact = await prisma.contact.deleteMany({
      where: {
        id: { in: contactIds },
      },
    });

    const customMessage =
      contact.length === 1
        ? "Contact deleted successfully"
        : "Contacts deleted successfully";
    res.status(200).json({ code: 200, message: customMessage });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const filterContacts = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { status, startDate, endDate } = req.query;
    const user = req.user;
    if (!user?.orgId) {
      return res.status(401).json({ code: 401, message: "Unauthorized" });
    }
    const whereCondition: any = {
      orgId: user?.orgId,
    };

    if (status !== undefined) {
      whereCondition.active = status === "true";
    }

    if (startDate) {
      const parsedStartDate = new Date(startDate as string);
      if (isNaN(parsedStartDate.getTime())) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid start date format." });
      }
      whereCondition.createdAt = {
        ...(whereCondition.createdAt || {}),
        gte: parsedStartDate,
      };
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate as string);
      if (isNaN(parsedEndDate.getTime())) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid end date format." });
      }
      whereCondition.createdAt = {
        ...(whereCondition.createdAt || {}),
        lte: parsedEndDate,
      };
    }

    const data = await prisma.contact.findMany({
      where: whereCondition,
    });
    res.status(200).json({
      code: 200,
      data,
      message: data.length > 0 ? "Success" : "No contacts found",
    });
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ code: 500, message: "Error fetching contacts" });
  }
};

export const unsubscribeContact = async (req: any, res: any) => {
  try {
    const email = req.body.email as string;
    if (!email) {
      throw new Error("Email not found");
    }
    const contact = await prisma.contact.findFirst({
      where: { email },
    });

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await prisma.contact.updateMany({
      where: { email },
      data: { unsubscribed: true },
    });

    return res
      .status(200)
      .json({ code: 200, message: "Contact unsubscribed successfully" });
  } catch (error) {
    console.error("Error unsubscribing contact:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};