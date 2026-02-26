import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { EmailEventService } from "../services/email.event.service";

const prisma = new PrismaClient();

/**
 * =====================================================
 * HOW TRACKING WORKS:
 * =====================================================
 * 
 * 1. OPEN TRACKING:
 *    - When sending email, we embed: <img src="SERVER_URL/api/track/open/CAMPAIGN_ID_LEAD_ID" />
 *    - When recipient opens email, their email client loads the image
 *    - Our server receives the request and records the open event
 *    - We return a 1x1 transparent PNG
 * 
 * 2. CLICK TRACKING:
 *    - Original links in email are replaced with: SERVER_URL/api/track/click/CAMPAIGN_ID_LEAD_ID?url=ORIGINAL_URL
 *    - When recipient clicks, request comes to our server first
 *    - We record the click event, then redirect to original URL
 * 
 * 3. REPLY TRACKING:
 *    - Option A: Gmail/Outlook webhook notifications
 *    - Option B: Poll inbox via IMAP/API for replies to our threadId
 *    - Option C: Manual marking via API
 * 
 * TRACKING ID FORMAT: campaignId_leadId
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
 * trackingId format: campaignId_leadId
 */
export const trackOpen = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { trackingId } = req.params as any;
    console.log(`[Tracking:Open] ========== START ==========`);
    console.log(`[Tracking:Open] trackingId: ${trackingId}`);
    console.log(`[Tracking:Open] IP: ${req.ip || req.headers["x-forwarded-for"]}`);
    console.log(`[Tracking:Open] User-Agent: ${req.headers["user-agent"]}`);

    const [campaignId, leadId] = trackingId.split("_");
    console.log(`[Tracking:Open] Parsed - campaignId: ${campaignId}, leadId: ${leadId}`);

    if (!campaignId || !leadId) {
      console.log(`[Tracking:Open] ❌ Invalid trackingId format`);
      res.setHeader("Content-Type", "image/png");
      res.send(TRANSPARENT_PIXEL);
      return;
    }

    // Find the most recent email send for this campaign and lead
    const emailSend = await prisma.emailSend.findFirst({
      where: { campaignId, leadId },
      orderBy: { createdAt: "desc" },
    });
    console.log(`[Tracking:Open] EmailSend found: ${emailSend ? emailSend.id : "NOT FOUND"}`);

    // Track the open event
    const result = await EmailEventService.trackOpened({
      campaignId,
      leadId,
      emailSendId: emailSend?.id,
      ipAddress: req.ip || req.headers["x-forwarded-for"] as string,
      userAgent: req.headers["user-agent"],
    });
    console.log(`[Tracking:Open] ✅ Event tracked:`, result);
    console.log(`[Tracking:Open] Duration: ${Date.now() - startTime}ms`);
    console.log(`[Tracking:Open] ========== END ==========\n`);

    // Always return the tracking pixel
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(TRANSPARENT_PIXEL);
  } catch (error) {
    console.error(`[Tracking:Open] ❌ Error:`, error);
    console.log(`[Tracking:Open] Duration: ${Date.now() - startTime}ms`);
    res.setHeader("Content-Type", "image/png");
    res.send(TRANSPARENT_PIXEL);
  }
};

/**
 * Track link click event
 * URL: GET /api/track/click/:trackingId?url=ORIGINAL_URL
 * trackingId format: campaignId_leadId
 */
export const trackClick = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { trackingId } = req.params as any;
    const { url } = req.query as any;
    console.log(`[Tracking:Click] ========== START ==========`);
    console.log(`[Tracking:Click] trackingId: ${trackingId}`);
    console.log(`[Tracking:Click] url: ${url}`);
    console.log(`[Tracking:Click] IP: ${req.ip || req.headers["x-forwarded-for"]}`);

    const [campaignId, leadId] = trackingId.split("_");
    console.log(`[Tracking:Click] Parsed - campaignId: ${campaignId}, leadId: ${leadId}`);

    const redirectUrl = url as string || "https://google.com";

    if (!campaignId || !leadId) {
      console.log(`[Tracking:Click] ❌ Invalid trackingId format, redirecting to: ${redirectUrl}`);
      res.redirect(redirectUrl);
      return;
    }

    // Find the most recent email send for this campaign and lead
    const emailSend = await prisma.emailSend.findFirst({
      where: { campaignId, leadId },
      orderBy: { createdAt: "desc" },
    });
    console.log(`[Tracking:Click] EmailSend found: ${emailSend ? emailSend.id : "NOT FOUND"}`);

    // Track the click event
    const result = await EmailEventService.trackClicked({
      campaignId,
      leadId,
      emailSendId: emailSend?.id,
      linkUrl: redirectUrl,
      ipAddress: req.ip || req.headers["x-forwarded-for"] as string,
      userAgent: req.headers["user-agent"],
    });
    console.log(`[Tracking:Click] ✅ Event tracked:`, result);
    console.log(`[Tracking:Click] Redirecting to: ${redirectUrl}`);
    console.log(`[Tracking:Click] Duration: ${Date.now() - startTime}ms`);
    console.log(`[Tracking:Click] ========== END ==========\n`);

    // Redirect to original URL
    res.redirect(redirectUrl);
  } catch (error) {
    console.error(`[Tracking:Click] ❌ Error:`, error);
    console.log(`[Tracking:Click] Duration: ${Date.now() - startTime}ms`);
    res.redirect(req.query.url as string || "https://google.com");
  }
};

/**
 * Track reply event (called via webhook or manually)
 * URL: POST /api/track/reply
 * Body: { campaignId, leadEmail, isPositive?, threadId? }
 */
export const trackReply = async (req: Request, res: Response): Promise<any> => {
  const startTime = Date.now();
  try {
    const { campaignId, leadEmail, isPositive = false, threadId } = req.body;
    console.log(`[Tracking:Reply] ========== START ==========`);
    console.log(`[Tracking:Reply] campaignId: ${campaignId}`);
    console.log(`[Tracking:Reply] leadEmail: ${leadEmail}`);
    console.log(`[Tracking:Reply] isPositive: ${isPositive}`);
    console.log(`[Tracking:Reply] threadId: ${threadId}`);

    if (!campaignId || !leadEmail) {
      console.log(`[Tracking:Reply] ❌ Missing required fields`);
      return res.status(400).json({ code: 400, message: "campaignId and leadEmail are required" });
    }

    // Find lead by email
    const lead = await prisma.lead.findFirst({
      where: { email: leadEmail.toLowerCase() },
    });
    console.log(`[Tracking:Reply] Lead found: ${lead ? lead.id : "NOT FOUND"}`);

    if (!lead) {
      console.log(`[Tracking:Reply] ❌ Lead not found for email: ${leadEmail}`);
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
    console.log(`[Tracking:Reply] EmailSend found: ${emailSend ? emailSend.id : "NOT FOUND"}`);

    // Track the reply event
    const result = await EmailEventService.trackReplied({
      campaignId,
      leadId: lead.id,
      emailSendId: emailSend?.id,
      isPositive,
    });
    console.log(`[Tracking:Reply] ✅ Event tracked:`, result);
    console.log(`[Tracking:Reply] Duration: ${Date.now() - startTime}ms`);
    console.log(`[Tracking:Reply] ========== END ==========\n`);

    res.status(200).json({ code: 200, message: "Reply tracked successfully" });
  } catch (error) {
    console.error(`[Tracking:Reply] ❌ Error:`, error);
    console.log(`[Tracking:Reply] Duration: ${Date.now() - startTime}ms`);
    res.status(500).json({ code: 500, message: "Error tracking reply" });
  }
};

/**
 * Track bounce event (called via webhook)
 * URL: POST /api/track/bounce
 * Body: { campaignId, leadEmail, isSenderBounce? }
 */
export const trackBounce = async (req: Request, res: Response): Promise<any> => {
  const startTime = Date.now();
  try {
    const { campaignId, leadEmail, isSenderBounce = false } = req.body;
    console.log(`[Tracking:Bounce] ========== START ==========`);
    console.log(`[Tracking:Bounce] campaignId: ${campaignId}`);
    console.log(`[Tracking:Bounce] leadEmail: ${leadEmail}`);
    console.log(`[Tracking:Bounce] isSenderBounce: ${isSenderBounce}`);

    if (!campaignId || !leadEmail) {
      console.log(`[Tracking:Bounce] ❌ Missing required fields`);
      return res.status(400).json({ code: 400, message: "campaignId and leadEmail are required" });
    }

    const lead = await prisma.lead.findFirst({
      where: { email: leadEmail.toLowerCase() },
    });
    console.log(`[Tracking:Bounce] Lead found: ${lead ? lead.id : "NOT FOUND"}`);

    if (!lead) {
      console.log(`[Tracking:Bounce] ❌ Lead not found for email: ${leadEmail}`);
      return res.status(404).json({ code: 404, message: "Lead not found" });
    }

    const emailSend = await prisma.emailSend.findFirst({
      where: { campaignId, leadId: lead.id },
      orderBy: { createdAt: "desc" },
    });
    console.log(`[Tracking:Bounce] EmailSend found: ${emailSend ? emailSend.id : "NOT FOUND"}`);

    const result = await EmailEventService.trackBounced({
      campaignId,
      leadId: lead.id,
      emailSendId: emailSend?.id,
      isSenderBounce,
    });
    console.log(`[Tracking:Bounce] ✅ Event tracked:`, result);
    console.log(`[Tracking:Bounce] Duration: ${Date.now() - startTime}ms`);
    console.log(`[Tracking:Bounce] ========== END ==========\n`);

    res.status(200).json({ code: 200, message: "Bounce tracked successfully" });
  } catch (error) {
    console.error(`[Tracking:Bounce] ❌ Error:`, error);
    console.log(`[Tracking:Bounce] Duration: ${Date.now() - startTime}ms`);
    res.status(500).json({ code: 500, message: "Error tracking bounce" });
  }
};

/**
 * Track unsubscribe event
 * URL: GET /api/track/unsubscribe/:trackingId
 * trackingId format: campaignId_leadId
 */
export const trackUnsubscribe = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { trackingId } = req.params as any;
    console.log(`[Tracking:Unsubscribe] ========== START ==========`);
    console.log(`[Tracking:Unsubscribe] trackingId: ${trackingId}`);

    const [campaignId, leadId] = trackingId.split("_");
    console.log(`[Tracking:Unsubscribe] Parsed - campaignId: ${campaignId}, leadId: ${leadId}`);

    if (!campaignId || !leadId) {
      console.log(`[Tracking:Unsubscribe] ❌ Invalid trackingId format`);
      res.status(400).send("Invalid unsubscribe link");
      return;
    }

    const emailSend = await prisma.emailSend.findFirst({
      where: { campaignId, leadId },
      orderBy: { createdAt: "desc" },
    });
    console.log(`[Tracking:Unsubscribe] EmailSend found: ${emailSend ? emailSend.id : "NOT FOUND"}`);

    const result = await EmailEventService.trackUnsubscribed({
      campaignId,
      leadId,
      emailSendId: emailSend?.id,
    });
    console.log(`[Tracking:Unsubscribe] ✅ Event tracked:`, result);
    console.log(`[Tracking:Unsubscribe] Duration: ${Date.now() - startTime}ms`);
    console.log(`[Tracking:Unsubscribe] ========== END ==========\n`);

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
    console.error(`[Tracking:Unsubscribe] ❌ Error:`, error);
    console.log(`[Tracking:Unsubscribe] Duration: ${Date.now() - startTime}ms`);
    res.status(500).send("Error processing unsubscribe");
  }
};

/**
 * Get all thread IDs for a sender email (for reply detection)
 */
export const getAllThreadsFromEmail = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.params as any;
    console.log(`[Tracking:Threads] Getting threads for sender: ${email}`);

    if (!email) {
      return res.status(400).json({ code: 400, message: "Email is required" });
    }

    const senderAccount = await prisma.senderAccount.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!senderAccount) {
      console.log(`[Tracking:Threads] ❌ Sender account not found: ${email}`);
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

    console.log(`[Tracking:Threads] ✅ Found ${threads.length} threads`);
    res.status(200).json({ code: 200, data: threads, message: "Threads found successfully" });
  } catch (error) {
    console.error("[Tracking:Threads] ❌ Error:", error);
    res.status(500).json({ code: 500, message: "Error getting threads" });
  }
};

// Legacy support for old tracking endpoint
export const trackEvent = async (req: Request, res: Response): Promise<void> => {
  const { type } = req.params;
  console.log(`[Tracking:Legacy] type: ${type}, trackingId: ${req.params.trackingId}`);
  
  if (type === "opened_count" || type === "open") {
    return trackOpen(req, res);
  }
  if (type === "clicked_count" || type === "click") {
    return trackClick(req, res);
  }
  
  console.log(`[Tracking:Legacy] ❌ Invalid type: ${type}`);
  res.status(400).json({ message: "Invalid tracking type" });
};
