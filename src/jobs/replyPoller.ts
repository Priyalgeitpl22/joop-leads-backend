import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { EmailEventService } from "../services/email.event.service";
import { EmailSendStatus } from "../models/enums";

const prisma = new PrismaClient();

/**
 * =====================================================
 * REPLY POLLING SERVICE
 * =====================================================
 * 
 * This service polls Gmail inbox to detect replies to our sent emails.
 * 
 * How it works:
 * 1. Query EmailSend records that have a threadId and status = SENT
 * 2. Group by sender account
 * 3. For each sender, use Gmail API to check if thread has new messages
 * 4. If thread has more than 1 message, it means there's a reply
 * 5. Mark the lead as replied
 * 
 * =====================================================
 */

interface ThreadInfo {
  emailSendId: string;
  threadId: string;
  campaignId: string;
  leadId: string;
  leadEmail: string;
  sentAt: Date;
}

interface SenderWithThreads {
  senderId: string;
  senderEmail: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  threads: ThreadInfo[];
}

/**
 * Check if Google OAuth token is expired
 */
const isTokenExpired = (expiryDate?: Date | null): boolean => {
  if (!expiryDate) return true;
  return Date.now() >= expiryDate.getTime();
};

/**
 * Refresh Google OAuth token
 */
const refreshGoogleToken = async (senderId: string, refreshToken: string): Promise<string> => {
  console.log(`[ReplyPoller] Refreshing token for sender ${senderId}`);

  const tokenUrl = "https://oauth2.googleapis.com/token";

  try {
    const response = await axios.post<{ access_token: string; expires_in: number }>(
      tokenUrl,
      null,
      {
        params: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        },
      }
    );

    const newAccessToken = response.data.access_token;
    const newExpiry = new Date(Date.now() + response.data.expires_in * 1000);

    // Update sender account with new token
    await prisma.senderAccount.update({
      where: { id: senderId },
      data: {
        accessToken: newAccessToken,
        tokenExpiry: newExpiry,
      },
    });

    console.log(`[ReplyPoller] ✅ Token refreshed for sender ${senderId}`);
    return newAccessToken;
  } catch (error: any) {
    console.error(`[ReplyPoller] ❌ Failed to refresh token:`, error.response?.data || error.message);
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
};

/**
 * Get thread details from Gmail API
 * Returns the number of messages in the thread
 */
const getThreadMessageCount = async (
  accessToken: string,
  threadId: string
): Promise<{ messageCount: number; hasReply: boolean; latestMessageFrom?: string }> => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          format: "metadata",
          metadataHeaders: ["From", "To"],
        },
      }
    );

    const thread = response.data;
    const messages = thread.messages || [];
    const messageCount = messages.length;

    // If more than 1 message, check if the latest is from someone else (a reply)
    let hasReply = false;
    let latestMessageFrom: string | undefined;

    if (messageCount > 1) {
      const latestMessage = messages[messages.length - 1];
      const headers = latestMessage.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");
      latestMessageFrom = fromHeader?.value;
      
      // It's a reply if the latest message is NOT from us
      // (We check if it's incoming by looking at labelIds)
      const labelIds = latestMessage.labelIds || [];
      hasReply = labelIds.includes("INBOX") || labelIds.includes("UNREAD");
    }

    return { messageCount, hasReply, latestMessageFrom };
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`[ReplyPoller] Thread ${threadId} not found (may have been deleted)`);
      return { messageCount: 0, hasReply: false };
    }
    throw error;
  }
};

/**
 * Poll for replies for a specific sender
 */
const pollRepliesForSender = async (sender: SenderWithThreads): Promise<number> => {
  console.log(`[ReplyPoller] Checking ${sender.threads.length} threads for sender ${sender.senderEmail}`);

  let accessToken = sender.accessToken;

  // Refresh token if expired
  if (!accessToken || isTokenExpired(sender.tokenExpiry)) {
    if (!sender.refreshToken) {
      console.log(`[ReplyPoller] ⚠️ No refresh token for sender ${sender.senderEmail}, skipping`);
      return 0;
    }
    accessToken = await refreshGoogleToken(sender.senderId, sender.refreshToken);
  }

  let repliesFound = 0;

  for (const thread of sender.threads) {
    try {
      console.log(`[ReplyPoller] Checking thread ${thread.threadId} for lead ${thread.leadEmail}`);

      const { messageCount, hasReply, latestMessageFrom } = await getThreadMessageCount(
        accessToken!,
        thread.threadId
      );

      console.log(`[ReplyPoller] Thread ${thread.threadId}: ${messageCount} messages, hasReply: ${hasReply}`);

      if (hasReply) {
        console.log(`[ReplyPoller] 🎉 Reply detected from ${latestMessageFrom}`);

        // Track the reply
        await EmailEventService.trackReplied({
          campaignId: thread.campaignId,
          leadId: thread.leadId,
          emailSendId: thread.emailSendId,
          isPositive: false, // You can add sentiment analysis later
        });

        // Mark EmailSend as having a reply (to avoid re-processing)
        await prisma.emailSend.update({
          where: { id: thread.emailSendId },
          data: { status: EmailSendStatus.REPLIED },
        });

        repliesFound++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`[ReplyPoller] ❌ Error checking thread ${thread.threadId}:`, error.message);
    }
  }

  return repliesFound;
};

/**
 * Main polling function - run this periodically (e.g., every 5 minutes)
 */
export async function pollForReplies(): Promise<void> {
  console.log(`[ReplyPoller] ========== POLL START ==========`);
  console.log(`[ReplyPoller] Time: ${new Date().toISOString()}`);

  try {
    // Get all EmailSend records with threadId that are SENT (not already replied)
    const emailSends = await prisma.emailSend.findMany({
      where: {
        threadId: { not: null },
        status: "SENT",
        // Only check emails sent in the last 30 days
        sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      include: {
        sender: true,
        lead: true,
        campaign: true,
      },
      orderBy: { sentAt: "desc" },
    });

    console.log(`[ReplyPoller] Found ${emailSends.length} sent emails to check for replies`);

    if (emailSends.length === 0) {
      console.log(`[ReplyPoller] No emails to check`);
      console.log(`[ReplyPoller] ========== POLL END ==========\n`);
      return;
    }

    // Group by sender
    const senderMap = new Map<string, SenderWithThreads>();

    for (const send of emailSends) {
      if (!send.sender || !send.threadId || !send.lead || !send.campaign) continue;
      
      // Only process Gmail senders
      if (send.sender.provider !== "gmail") continue;

      const senderId = send.sender.id;

      if (!senderMap.has(senderId)) {
        senderMap.set(senderId, {
          senderId: send.sender.id,
          senderEmail: send.sender.email,
          accessToken: send.sender.accessToken,
          refreshToken: send.sender.refreshToken,
          tokenExpiry: send.sender.tokenExpiry,
          threads: [],
        });
      }

      senderMap.get(senderId)!.threads.push({
        emailSendId: send.id,
        threadId: send.threadId,
        campaignId: send.campaign.id,
        leadId: send.lead.id,
        leadEmail: send.lead.email,
        sentAt: send.sentAt || send.createdAt,
      });
    }

    console.log(`[ReplyPoller] Processing ${senderMap.size} sender account(s)`);

    let totalReplies = 0;

    for (const [senderId, sender] of senderMap) {
      try {
        const replies = await pollRepliesForSender(sender);
        totalReplies += replies;
      } catch (error: any) {
        console.error(`[ReplyPoller] ❌ Error polling sender ${sender.senderEmail}:`, error.message);
      }
    }

    console.log(`[ReplyPoller] ✅ Total replies found: ${totalReplies}`);
    console.log(`[ReplyPoller] ========== POLL END ==========\n`);
  } catch (error: any) {
    console.error(`[ReplyPoller] ❌ Polling error:`, error.message);
    console.log(`[ReplyPoller] ========== POLL END (with error) ==========\n`);
  }
}

/**
 * Start the reply polling cron job
 * Runs every 5 minutes
 */
export function startReplyPolling(intervalMinutes: number = 5): void {
  console.log(`[ReplyPoller] Starting reply polling every ${intervalMinutes} minutes`);

  // Run immediately on start
  pollForReplies();

  // Then run periodically
  setInterval(() => {
    pollForReplies();
  }, intervalMinutes * 60 * 1000);
}

// Export for manual testing
export { getThreadMessageCount, pollRepliesForSender };

