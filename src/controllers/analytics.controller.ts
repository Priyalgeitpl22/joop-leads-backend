import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Interface for org-level analytics
export interface OrgAnalytics {
  orgId: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  stats: {
    emailsSent: number;
    opened: number;
    replied: number;
    positiveReply: number;
    bounced: number;
    unsubscribed: number;
  };
  rates: {
    openRate: number;
    replyRate: number;
    bounceRate: number;
  };
}

const VALID_COUNT_TYPES = [
  "openedCount",
  "clickedCount",
  "repliedCount",
  "positiveReplyCount",
  "bouncedCount",
];

const isValidCountType = (countType: string): boolean => {
  return VALID_COUNT_TYPES.includes(countType);
};

export const incrementCampaignCount = async (campaignId: string, countType: string) => {
  return await prisma.campaignAnalytics.updateMany({
    where: { campaignId },
    data: { [countType]: { increment: 1 } },
  });
};

export const updateCampaignAnalytics = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId, countType } = req.body;

    if (!campaignId || !countType) {
      return res.status(400).json({ error: "campaignId and countType are required!" });
    }

    if (!isValidCountType(countType)) {
      return res.status(400).json({ error: "Invalid countType provided!" });
    }

    const result = await incrementCampaignCount(campaignId, countType);

    if (result.count === 0) {
      res.json({ code: 404, message: "Campaign analytics not found!" });
    }

    res.json({ code: 200, message: `Successfully updated ${countType}!` });
  } catch (error) {
    console.error("Error updating campaign analytics:", error);
    res.json({ code: 500, message: "Error updating campaign analytics" });
  }
};

export const getCampaignAnalytics = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId } = req.params;
    const analytics = await prisma.campaignAnalytics.findUnique({
      where: { campaignId },
    });
    if (!analytics) {
      return res.status(404).json({ code: 404, message: "Campaign analytics not found!" });
    }
    res.status(200).json({ code: 200, message: "Campaign analytics fetched successfully", data: analytics });
  } catch (error) {
    console.error("Error getting campaign analytics:", error);
    res.status(500).json({ code: 500, message: "Error getting campaign analytics" });
  }
};

/**
 * Get organization-level analytics with optional date filtering
 * Query params:
 *  - from: ISO date string (optional) - start date filter
 *  - to: ISO date string (optional) - end date filter
 */
export const getOrgAnalytics = async (req: Request, res: Response): Promise<any> => {
  try {
    const { orgId } = req.params;
    const { from, to } = req.query;

    // Parse date filters
    const fromDate = from ? new Date(from as string) : null;
    const toDate = to ? new Date(to as string) : null;

    // Build date filter for EmailSend
    const dateFilter: any = {};
    if (fromDate || toDate) {
      dateFilter.sentAt = {};
      if (fromDate) dateFilter.sentAt.gte = fromDate;
      if (toDate) dateFilter.sentAt.lte = toDate;
    }

    // Get all campaigns for this org
    const campaigns = await prisma.campaign.findMany({
      where: { orgId },
      select: { id: true },
    });

    if (campaigns.length === 0) {
      return res.status(200).json({
        code: 200,
        message: "No campaigns found for this organization",
        data: {
          orgId,
          dateRange: { from: fromDate, to: toDate },
          stats: {
            emailsSent: 0,
            opened: 0,
            replied: 0,
            positiveReply: 0,
            bounced: 0,
            unsubscribed: 0,
          },
          rates: {
            openRate: 0,
            replyRate: 0,
            bounceRate: 0,
          },
        },
      });
    }

    const campaignIds = campaigns.map((c) => c.id);

    // Count emails sent (with date filter if provided)
    const emailsSent = await prisma.emailSend.count({
      where: {
        campaignId: { in: campaignIds },
        status: "SENT",
        // ...(fromDate || toDate ? { sentAt: dateFilter.sentAt } : {}),
      },
    });

    // Build event date filter
    const eventDateFilter: any = {};
    if (fromDate || toDate) {
      eventDateFilter.timestamp = {};
      if (fromDate) eventDateFilter.timestamp.gte = fromDate;
      if (toDate) eventDateFilter.timestamp.lte = toDate;
    }

    // Count events by type
    const [opened, replied, positiveReply, bounced, unsubscribed] = await Promise.all([
      // Opened
      prisma.emailEvent.count({
        where: {
          emailSend: { campaignId: { in: campaignIds } },
          type: "OPENED",
          ...(fromDate || toDate ? { timestamp: eventDateFilter.timestamp } : {}),
        },
      }),
      // Replied
      prisma.emailEvent.count({
        where: {
          emailSend: { campaignId: { in: campaignIds } },
          type: "REPLIED",
          ...(fromDate || toDate ? { timestamp: eventDateFilter.timestamp } : {}),
        },
      }),
      // Positive Reply
      prisma.emailEvent.count({
        where: {
          emailSend: { campaignId: { in: campaignIds } },
          type: "POSITIVE_REPLY",
          ...(fromDate || toDate ? { timestamp: eventDateFilter.timestamp } : {}),
        },
      }),
      // Bounced
      prisma.emailEvent.count({
        where: {
          emailSend: { campaignId: { in: campaignIds } },
          type: "BOUNCED",
          ...(fromDate || toDate ? { timestamp: eventDateFilter.timestamp } : {}),
        },
      }),
      // Unsubscribed
      prisma.emailEvent.count({
        where: {
          emailSend: { campaignId: { in: campaignIds } },
          type: "UNSUBSCRIBED",
          ...(fromDate || toDate ? { timestamp: eventDateFilter.timestamp } : {}),
        },
      }),
    ]);

    // Calculate rates
    const openRate = emailsSent > 0 ? (opened / emailsSent) * 100 : 0;
    const replyRate = emailsSent > 0 ? ((replied + positiveReply) / emailsSent) * 100 : 0;
    const bounceRate = emailsSent > 0 ? (bounced / emailsSent) * 100 : 0;

    const analytics: OrgAnalytics = {
      orgId,
      dateRange: { from: fromDate, to: toDate },
      stats: {
        emailsSent,
        opened,
        replied,
        positiveReply,
        bounced,
        unsubscribed,
      },
      rates: {
        openRate: Math.round(openRate * 100) / 100,
        replyRate: Math.round(replyRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
      },
    };

    res.status(200).json({
      code: 200,
      message: "Organization analytics fetched successfully",
      data: analytics,
    });
  } catch (error) {
    console.error("Error getting org analytics:", error);
    res.status(500).json({ code: 500, message: "Error getting organization analytics" });
  }
};
