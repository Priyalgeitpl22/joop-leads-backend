import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { EmailEventService } from "../services/email.event.service";

const prisma = new PrismaClient();

/**
 * =====================================================
 * HOW TRACKING WORKS:
 * =====================================================
 * 
 * 1. OPEN TRACKING:
 *    - When sending email, we embed: <img src="SERVER_URL/api/track/open/CAMPAIGN_ID_LEAD_EMAIL" />
 *    - When recipient opens email, their email client loads the image
 *    - Our server receives the request and records the open event
 *    - We return a 1x1 transparent PNG
 * 
 * 2. CLICK TRACKING:
 *    - Original links in email are replaced with: SERVER_URL/api/track/click/CAMPAIGN_ID_LEAD_EMAIL?url=ORIGINAL_URL
 *    - When recipient clicks, request comes to our server first
 *    - We record the click event, then redirect to original URL
 * 
 * 3. REPLY TRACKING:
 *    - Option A: Gmail/Outlook webhook notifications
 *    - Option B: Poll inbox via IMAP/API for replies to our threadId
 *    - Option C: Manual marking via API
 * 
 * =====================================================
 */

// Transparent 1x1 pixel PNG (base64)
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

/**
 * Track email open event
 * URL: GET /api/track/open/:trackingId
 * trackingId format: campaignId_leadEmail
 */
export const trackOpen = async (req: Request, res: Response): Promise<void> => {
  try {
    const { trackingId } = req.params;
    const [campaignId, leadEmail] = trackingId.split("_");

    if (!campaignId || !leadEmail) {
      res.setHeader("Content-Type", "image/png");
      res.send(TRANSPARENT_PIXEL);
      return;
    }

    // Find lead by email
    const lead = await prisma.lead.findFirst({
      where: { email: leadEmail.toLowerCase() },
    });

    if (lead) {
      // Find the most recent email send for this campaign and lead
      const emailSend = await prisma.emailSend.findFirst({
        where: { campaignId, leadId: lead.id },
        orderBy: { createdAt: "desc" },
      });

      // Track the open event
      await EmailEventService.trackOpened({
        campaignId,
        leadId: lead.id,
        emailSendId: emailSend?.id,
        ipAddress: req.ip || req.headers["x-forwarded-for"] as string,
        userAgent: req.headers["user-agent"],
      });
    }

    // Always return the tracking pixel
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(TRANSPARENT_PIXEL);
  } catch (error) {
    console.error("[Tracking] Error tracking open:", error);
    res.setHeader("Content-Type", "image/png");
    res.send(TRANSPARENT_PIXEL);
  }
};

/**
 * Track link click event
 * URL: GET /api/track/click/:trackingId?url=ORIGINAL_URL
 * trackingId format: campaignId_leadEmail
 */
export const trackClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query;
    const [campaignId, leadEmail] = trackingId.split("_");

    const redirectUrl = url as string || "https://google.com";

    if (!campaignId || !leadEmail) {
      res.redirect(redirectUrl);
      return;
    }

    // Find lead by email
    const lead = await prisma.lead.findFirst({
      where: { email: leadEmail.toLowerCase() },
    });

    if (lead) {
      // Find the most recent email send for this campaign and lead
      const emailSend = await prisma.emailSend.findFirst({
        where: { campaignId, leadId: lead.id },
        orderBy: { createdAt: "desc" },
      });

      // Track the click event
      await EmailEventService.trackClicked({
        campaignId,
        leadId: lead.id,
        emailSendId: emailSend?.id,
        linkUrl: redirectUrl,
        ipAddress: req.ip || req.headers["x-forwarded-for"] as string,
        userAgent: req.headers["user-agent"],
      });
    }

    // Redirect to original URL
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("[Tracking] Error tracking click:", error);
    res.redirect(req.query.url as string || "https://google.com");
  }
};

/**
 * Track reply event (called via webhook or manually)
 * URL: POST /api/track/reply
 * Body: { campaignId, leadEmail, isPositive?, threadId? }
 */
export const trackReply = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId, leadEmail, isPositive = false, threadId } = req.body;

    if (!campaignId || !leadEmail) {
      return res.status(400).json({ code: 400, message: "campaignId and leadEmail are required" });
    }

    // Find lead by email
    const lead = await prisma.lead.findFirst({
      where: { email: leadEmail.toLowerCase() },
    });

    if (!lead) {
      return res.status(404).json({ code: 404, message: "Lead not found" });
    }

    // Find email send (optionally by threadId)
    const emailSend = await prisma.emailSend.findFirst({
      where: {
        campaignId,
        leadId: lead.id,
        ...(threadId ? { threadId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    // Track the reply event
    await EmailEventService.trackReplied({
      campaignId,
      leadId: lead.id,
      emailSendId: emailSend?.id,
      isPositive,
    });

    res.status(200).json({ code: 200, message: "Reply tracked successfully" });
  } catch (error) {
    console.error("[Tracking] Error tracking reply:", error);
    res.status(500).json({ code: 500, message: "Error tracking reply" });
  }
};

/**
 * Track bounce event (called via webhook)
 * URL: POST /api/track/bounce
 * Body: { campaignId, leadEmail, isSenderBounce? }
 */
export const trackBounce = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignId, leadEmail, isSenderBounce = false } = req.body;

    if (!campaignId || !leadEmail) {
      return res.status(400).json({ code: 400, message: "campaignId and leadEmail are required" });
    }

    const lead = await prisma.lead.findFirst({
      where: { email: leadEmail.toLowerCase() },
    });

    if (!lead) {
      return res.status(404).json({ code: 404, message: "Lead not found" });
    }

    const emailSend = await prisma.emailSend.findFirst({
      where: { campaignId, leadId: lead.id },
      orderBy: { createdAt: "desc" },
    });

    await EmailEventService.trackBounced({
      campaignId,
      leadId: lead.id,
      emailSendId: emailSend?.id,
      isSenderBounce,
    });

    res.status(200).json({ code: 200, message: "Bounce tracked successfully" });
  } catch (error) {
    console.error("[Tracking] Error tracking bounce:", error);
    res.status(500).json({ code: 500, message: "Error tracking bounce" });
  }
};

/**
 * Track unsubscribe event
 * URL: GET /api/track/unsubscribe/:trackingId
 * trackingId format: campaignId_leadEmail
 */
export const trackUnsubscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { trackingId } = req.params;
    const [campaignId, leadEmail] = trackingId.split("_");

    if (!campaignId || !leadEmail) {
      res.status(400).send("Invalid unsubscribe link");
      return;
    }

    const lead = await prisma.lead.findFirst({
      where: { email: leadEmail.toLowerCase() },
    });

    if (lead) {
      const emailSend = await prisma.emailSend.findFirst({
        where: { campaignId, leadId: lead.id },
        orderBy: { createdAt: "desc" },
      });

      await EmailEventService.trackUnsubscribed({
        campaignId,
        leadId: lead.id,
        emailSendId: emailSend?.id,
      });
    }

    // Show unsubscribe confirmation page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Unsubscribed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>You have been unsubscribed</h1>
          <p>You will no longer receive emails from this campaign.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("[Tracking] Error tracking unsubscribe:", error);
    res.status(500).send("Error processing unsubscribe");
  }
};

/**
 * Get all thread IDs for a sender email (for reply detection)
 */
export const getAllThreadsFromEmail = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ code: 400, message: "Email is required" });
    }

    const senderAccount = await prisma.senderAccount.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!senderAccount) {
      return res.status(404).json({ code: 404, message: "Sender account not found" });
    }

    const data = await prisma.emailSend.findMany({
      where: { senderId: senderAccount.id },
      select: { threadId: true, campaignId: true, leadId: true },
    });

    const threads = data
      .filter((elem) => elem.threadId !== null)
      .map((elem) => ({
        threadId: elem.threadId,
        campaignId: elem.campaignId,
        leadId: elem.leadId,
      }));

    res.status(200).json({ code: 200, data: threads, message: "Threads found successfully" });
  } catch (error) {
    console.error("[Tracking] Error getting threads:", error);
    res.status(500).json({ code: 500, message: "Error getting threads" });
  }
};

// Legacy support for old tracking endpoint
export const trackEvent = async (req: Request, res: Response): Promise<void> => {
  const { type } = req.params;
  
  if (type === "opened_count" || type === "open") {
    return trackOpen(req, res);
  }
  if (type === "clicked_count" || type === "click") {
    return trackClick(req, res);
  }
  
  res.status(400).json({ message: "Invalid tracking type" });
};
