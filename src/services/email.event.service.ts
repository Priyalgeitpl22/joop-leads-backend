import { PrismaClient, EventType } from "@prisma/client";

const prisma = new PrismaClient();

export interface TrackEventOptions {
  campaignId: string;
  leadId: string;
  emailSendId?: string;
  ipAddress?: string;
  userAgent?: string;
  linkUrl?: string;
  city?: string;
  country?: string;
}

export class EmailEventService {
  /**
   * Track email sent event
   */
  static async trackSent(options: TrackEventOptions) {
    const { campaignId, leadId, emailSendId } = options;
    console.log(`[EmailEventService] trackSent - campaignId: ${campaignId}, leadId: ${leadId}`);

    // Update CampaignLead lastSentAt
    const updateResult = await prisma.campaignLead.updateMany({
      where: { campaignId, leadId },
      data: { lastSentAt: new Date() },
    });
    console.log(`[EmailEventService] Updated CampaignLead lastSentAt, count: ${updateResult.count}`);

    // Increment campaign analytics
    await this.incrementAnalytics(campaignId, "sentCount");

    // Create event if emailSendId provided
    if (emailSendId) {
      await prisma.emailEvent.create({
        data: {
          type: "SENT",
          emailSendId,
          leadId,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      console.log(`[EmailEventService] Created SENT event for emailSendId: ${emailSendId}`);
    }

    return { success: true, event: "SENT" };
  }

  /**
   * Track email opened event
   */
  static async trackOpened(options: TrackEventOptions) {
    const { campaignId, leadId, emailSendId, ipAddress, userAgent, city, country } = options;
    console.log(`[EmailEventService] trackOpened - campaignId: ${campaignId}, leadId: ${leadId}, emailSendId: ${emailSendId}`);

    // Check if this email has already been opened (to only count once per email)
    let isFirstOpen = false;
    if (emailSendId) {
      const existingOpenEvent = await prisma.emailEvent.findFirst({
        where: { emailSendId, type: "OPENED" },
      });
      isFirstOpen = !existingOpenEvent;
      console.log(`[EmailEventService] isFirstOpen: ${isFirstOpen}`);
    }

    // Update CampaignLead lastOpenedAt
    const updateResult = await prisma.campaignLead.updateMany({
      where: { campaignId, leadId },
      data: { lastOpenedAt: new Date() },
    });
    console.log(`[EmailEventService] Updated CampaignLead lastOpenedAt, count: ${updateResult.count}`);

    // Increment campaign analytics only on first open
    if (isFirstOpen) {
      await this.incrementAnalytics(campaignId, "openedCount");
      console.log(`[EmailEventService] Incremented openedCount (first open)`);
    } else {
      console.log(`[EmailEventService] Skipped incrementing openedCount (already opened)`);
    }

    // Create event
    if (emailSendId) {
      await prisma.emailEvent.create({
        data: {
          type: "OPENED",
          emailSendId,
          leadId,
          ipAddress,
          userAgent,
          city,
          country,
        },
      });
      console.log(`[EmailEventService] Created OPENED event for emailSendId: ${emailSendId}`);
    } else {
      console.log(`[EmailEventService] ⚠️ No emailSendId provided, skipping event creation`);
    }

    // Check if should stop sending based on campaign settings
    await this.checkStopSending(campaignId, leadId, "OPEN");

    return { success: true, event: "OPENED", isFirstOpen };
  }

  /**
   * Track link clicked event
   */
  static async trackClicked(options: TrackEventOptions) {
    const { campaignId, leadId, emailSendId, linkUrl, ipAddress, userAgent, city, country } = options;
    console.log(`[EmailEventService] trackClicked - campaignId: ${campaignId}, leadId: ${leadId}, linkUrl: ${linkUrl}`);

    // Update CampaignLead lastClickedAt
    const updateResult = await prisma.campaignLead.updateMany({
      where: { campaignId, leadId },
      data: { lastClickedAt: new Date() },
    });
    console.log(`[EmailEventService] Updated CampaignLead lastClickedAt, count: ${updateResult.count}`);

    // Increment campaign analytics
    await this.incrementAnalytics(campaignId, "clickedCount");

    // Create event
    if (emailSendId) {
      await prisma.emailEvent.create({
        data: {
          type: "CLICKED",
          emailSendId,
          leadId,
          linkUrl,
          ipAddress,
          userAgent,
          city,
          country,
        },
      });
      console.log(`[EmailEventService] Created CLICKED event for emailSendId: ${emailSendId}`);
    } else {
      console.log(`[EmailEventService] ⚠️ No emailSendId provided, skipping event creation`);
    }

    // Check if should stop sending based on campaign settings
    await this.checkStopSending(campaignId, leadId, "CLICK");

    return { success: true, event: "CLICKED" };
  }

  /**
   * Track email replied event
   */
  static async trackReplied(options: TrackEventOptions & { isPositive?: boolean }) {
    const { campaignId, leadId, emailSendId, isPositive = false } = options;
    console.log(`[EmailEventService] trackReplied - campaignId: ${campaignId}, leadId: ${leadId}, isPositive: ${isPositive}`);

    // Update CampaignLead lastRepliedAt
    const updateResult = await prisma.campaignLead.updateMany({
      where: { campaignId, leadId },
      data: { lastRepliedAt: new Date() },
    });
    console.log(`[EmailEventService] Updated CampaignLead lastRepliedAt, count: ${updateResult.count}`);

    // Increment campaign analytics
    await this.incrementAnalytics(campaignId, "repliedCount");

    // Create event
    if (emailSendId) {
      await prisma.emailEvent.create({
        data: {
          type: isPositive ? "POSITIVE_REPLY" : "REPLIED",
          emailSendId,
          leadId,
        },
      });
      console.log(`[EmailEventService] Created ${isPositive ? "POSITIVE_REPLY" : "REPLIED"} event`);
    }

    // Check if should stop sending based on campaign settings
    await this.checkStopSending(campaignId, leadId, "REPLY");

    // Handle domain-based pausing if enabled
    await this.handleDomainPause(campaignId, leadId);

    return { success: true, event: isPositive ? "POSITIVE_REPLY" : "REPLIED" };
  }

  /**
   * Track email bounced event
   */
  static async trackBounced(options: TrackEventOptions & { isSenderBounce?: boolean }) {
    const { campaignId, leadId, emailSendId, isSenderBounce = false } = options;

    // Increment campaign analytics
    await this.incrementAnalytics(campaignId, "bouncedCount");

    // Create event
    if (emailSendId) {
      await prisma.emailEvent.create({
        data: {
          type: isSenderBounce ? "SENDER_BOUNCED" : "BOUNCED",
          emailSendId,
          leadId,
        },
      });
    }

    // Update email send status
    if (emailSendId) {
      await prisma.emailSend.update({
        where: { id: emailSendId },
        data: { status: "BOUNCED" },
      });
    }

    // Check bounce rate protection
    await this.checkBounceRateProtection(campaignId);

    return { success: true, event: isSenderBounce ? "SENDER_BOUNCED" : "BOUNCED" };
  }

  /**
   * Track unsubscribe event
   */
  static async trackUnsubscribed(options: TrackEventOptions) {
    const { campaignId, leadId, emailSendId } = options;

    // Increment campaign analytics
    await this.incrementAnalytics(campaignId, "unsubscribedCount");

    // Create event
    if (emailSendId) {
      await prisma.emailEvent.create({
        data: {
          type: "UNSUBSCRIBED",
          emailSendId,
          leadId,
        },
      });
    }

    // Stop sending to this lead
    await prisma.campaignLead.updateMany({
      where: { campaignId, leadId },
      data: {
        isStopped: true,
        stoppedAt: new Date(),
        stoppedReason: "UNSUBSCRIBED",
      },
    });

    return { success: true, event: "UNSUBSCRIBED" };
  }

  /**
   * Get all events for a lead in a campaign
   */
  static async getLeadEvents(campaignId: string, leadId: string) {
    const events = await prisma.emailEvent.findMany({
      where: {
        leadId,
        emailSend: { campaignId },
      },
      orderBy: { timestamp: "desc" },
      include: {
        emailSend: {
          select: {
            id: true,
            sequenceStep: true,
            status: true,
            sentAt: true,
          },
        },
      },
    });

    return events;
  }

  /**
   * Get event summary for a lead
   */
  static async getLeadEventSummary(campaignId: string, leadId: string) {
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { campaignId, leadId },
      select: {
        lastSentAt: true,
        lastOpenedAt: true,
        lastClickedAt: true,
        lastRepliedAt: true,
        currentSequenceStep: true,
        status: true,
        isStopped: true,
        stoppedReason: true,
      },
    });

    const eventCounts = await prisma.emailEvent.groupBy({
      by: ["type"],
      where: {
        leadId,
        emailSend: { campaignId },
      },
      _count: { type: true },
    });

    const counts = eventCounts.reduce((acc, curr) => {
      acc[curr.type] = curr._count.type;
      return acc;
    }, {} as Record<string, number>);

    return {
      ...campaignLead,
      eventCounts: {
        sent: counts["SENT"] || 0,
        opened: counts["OPENED"] || 0,
        clicked: counts["CLICKED"] || 0,
        replied: counts["REPLIED"] || 0,
        positiveReply: counts["POSITIVE_REPLY"] || 0,
        bounced: counts["BOUNCED"] || 0,
        unsubscribed: counts["UNSUBSCRIBED"] || 0,
      },
    };
  }

  // ============================================
  // Private helper methods
  // ============================================

  private static async incrementAnalytics(campaignId: string, field: string) {
    try {
      await prisma.campaignAnalytics.update({
        where: { campaignId },
        data: { [field]: { increment: 1 } },
      });
    } catch (err) {
      // Analytics record might not exist yet
      console.log(`[EmailEventService] Could not increment ${field} for campaign ${campaignId}`);
    }
  }

  private static async checkStopSending(campaignId: string, leadId: string, reason: "OPEN" | "CLICK" | "REPLY") {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { stopSending: true },
    });

    if (!campaign) return;

    const shouldStop =
      (reason === "REPLY" && campaign.stopSending === "REPLY") ||
      (reason === "CLICK" && campaign.stopSending === "CLICK") ||
      (reason === "OPEN" && campaign.stopSending === "OPEN");

    if (shouldStop) {
      await prisma.campaignLead.updateMany({
        where: { campaignId, leadId },
        data: {
          isStopped: true,
          stoppedAt: new Date(),
          stoppedReason: reason,
        },
      });
    }
  }

  private static async handleDomainPause(campaignId: string, leadId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { autoPauseSameDomain: true, orgId: true },
    });

    if (!campaign?.autoPauseSameDomain) return;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { email: true },
    });

    if (!lead) return;

    const domain = lead.email.toLowerCase().split("@")[1] || "";
    if (!domain) return;

    // Find and pause all leads from the same domain
    const leadsFromSameDomain = await prisma.lead.findMany({
      where: {
        orgId: campaign.orgId,
        email: { endsWith: `@${domain}` },
        id: { not: leadId }, // Exclude current lead
      },
      select: { id: true },
    });

    if (leadsFromSameDomain.length === 0) return;

    await prisma.campaignLead.updateMany({
      where: {
        campaignId,
        leadId: { in: leadsFromSameDomain.map((l) => l.id) },
        isStopped: false,
      },
      data: {
        isStopped: true,
        stoppedAt: new Date(),
        stoppedReason: "DOMAIN_REPLY",
      },
    });
  }

  private static async checkBounceRateProtection(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { autoPauseOnHighBounce: true, bounceRateThreshold: true, status: true },
    });

    if (!campaign?.autoPauseOnHighBounce || campaign.status !== "ACTIVE") return;

    const analytics = await prisma.campaignAnalytics.findUnique({
      where: { campaignId },
      select: { sentCount: true, bouncedCount: true },
    });

    if (!analytics || analytics.sentCount < 10) return;

    const bounceRate = (analytics.bouncedCount / analytics.sentCount) * 100;

    if (bounceRate >= campaign.bounceRateThreshold) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "PAUSED" },
      });
    }
  }
}

