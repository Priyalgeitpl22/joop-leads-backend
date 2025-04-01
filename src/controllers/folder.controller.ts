import { Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: User;
}

export const createFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const { name } = req.body;


    if (!user?.orgId) {
      throw new Error("Organization Id is required");
    }

    if (!name) {
      return res.status(400).json({
        code: 400,
        message: "All fields (name,orgId) are required.",
      });
    }

    const campaignFolder = await prisma.campaignFolder.create({
      data: { name, orgId: user?.orgId },
    });

    res.status(200).json({
      code: 200,
      data: campaignFolder,
      message: "campaign folder created successfully",
    });
  } catch (err) {
    console.error("Error creating folder:", err);
    res.status(500).json({
      code: 500,
      message: "Error creating folder ",
    });
  }
};

export const folderList = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;

    if (!user?.orgId) {
      return res.status(400).json({
        code: 400,
        message: "Organization Id is required",
      });
    }
  const foldersList = await prisma.campaignFolder.findMany({
      where: { orgId: user.orgId },
    });

    res.status(200).json({
      code: 200,
      data: foldersList,
      message: "Folders fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching folders:", err);
    res.status(500).json({
      code: 500,
      message: "Error fetching folders",
    });
  }
};

export const updateFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name } = req.body;

    if (!user?.orgId) {
      return res.status(400).json({
        code: 400,
        message: "Organization Id is required",
      });
    }

    if (!id || !name) {
      return res.status(400).json({
        code: 400,
        message: "Folder ID and name are required.",
      });
    }


    const existingFolder = await prisma.campaignFolder.findUnique({
      where: { id },
    });

    if (!existingFolder) {
      return res.status(404).json({
        code: 404,
        message: "Folder not found",
      });
    }

    if (existingFolder.orgId !== user.orgId) {
      return res.status(403).json({
        code: 403,
        message: "Unauthorized to update this folder",
      });
    }
    const updatedFolder = await prisma.campaignFolder.update({
      where: { id },
      data: { name },
    });

    res.status(200).json({
      code: 200,
      data: updatedFolder,
      message: "Campaign folder updated successfully",
    });
  } catch (err) {
    console.error("Error updating folder:", err);
    res.status(500).json({
      code: 500,
      message: "Error updating folder",
    });
  }
};



export const deleteFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {

    const user = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        code: 400,
        message: "Folder ID is required",
      });
    }
    if (!user?.orgId) {
      return res.status(400).json({
        code: 400,
        message: "Organization Id is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        code: 400,
        message: "ID is required",
      });
    }


    const folder = await prisma.campaignFolder.findUnique({
      where: { id: id },
    });

    if (!folder) {
      return res.status(404).json({
        code: 404,
        message: "Folder not found",
      });
    }

    if (folder.orgId !== user.orgId) {
      return res.status(403).json({
        code: 403,
        message: "Unauthorized to delete this folder",
      });
    }
    await prisma.campaignFolder.delete({
      where: { id: id },
    });

    res.status(200).json({
      code: 200,
      message: "Folder deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting folder:", err);
    res.status(500).json({
      code: 500,
      message: "Error deleting folder",
    });
  }
};

export const getFolderById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const { folderId } = req.query;

    if (!user?.orgId) {
      return res.status(400).json({
        code: 400,
        message: "Organization Id is required",
      });
    }

    const whereCondition: any = { orgId: user.orgId };

    if (folderId) {
      whereCondition.id = folderId;
    }
    const foldersList = await prisma.campaignFolder.findMany({
      where: whereCondition,
      include: {
        campaigns: {
          include: {
            campaign: {
              select: {
                id: true,
                campaignName: true,
                createdAt: true,
                sequencesIds: true,
                sequences: true,
                csvSettings: true,
                csvFile: true,
                schedule: true,
                status: true,
                CampaignAnalytics: true,
                EmailTriggerLog: true,
              },
            },
          },
        },
      },
    });

    let campaignCount = 0;

    if (folderId) {
      const folder = foldersList.find((folder) => folder.id === folderId);
      if (folder) {
        campaignCount = folder.campaigns.length;
      }
    }

    res.status(200).json({
      code: 200,
      data: foldersList,
      campaignCount,
      message:
        foldersList.length > 0
          ? "Folders fetched successfully"
          : "No folders found",
    });
  } catch (err) {
    console.error("Error fetching folders:", err);
    res.status(500).json({
      code: 500,
      message: "Error fetching folders",
    });
  }
};





