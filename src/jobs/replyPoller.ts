import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { EmailEventService } from "../services/email.event.service";
import { EmailSendStatus } from "../models/enums";
import { parseBounceEmail } from "../utils/emailFormat";

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

interface SmtpEmailInfo {
  emailSendId: string;
  providerMsgId: string;
  campaignId: string;
  leadId: string;
  leadEmail: string;
  sentAt: Date;
}

interface SmtpSenderWithEmails {
  senderId: string;
  senderEmail: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapSecure: boolean;
  emails: SmtpEmailInfo[];
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
    if (error.response?.data?.error === 'invalid_grant') {
      console.error(`[ReplyPoller] ❌ Refresh token expired or revoked for sender ${senderId}. User needs to re-authenticate.`);
      throw new Error(`REAUTH_REQUIRED: Refresh token expired or revoked`);
    }
    console.error(`[ReplyPoller] ❌ Failed to refresh token:`, error.response?.data || error.message);
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
};

/**
 * Decode base64url encoded string
 */
const decodeBase64Url = (data: string): string => {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
};

/**
 * Decode quoted-printable encoded string
 */
const decodeQuotedPrintable = (text: string): string => {
  return text
    // Remove soft line breaks (= at end of line)
    .replace(/=\r?\n/g, '')
    // Decode hex-encoded characters (=XX)
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
};

/**
 * Extract clean reply text from raw MIME email source
 * Handles multipart messages, quoted-printable encoding, and strips quoted original
 */
const extractReplyFromMimeSource = (source: string): string => {
  // Check if it's a multipart message
  const boundaryMatch = source.match(/boundary="?([^"\r\n;]+)"?/i);

  let textContent = '';

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = source.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

    // Look for text/plain part first
    for (const part of parts) {
      if (part.includes('Content-Type: text/plain')) {
        // Extract content after the headers (double newline)
        const contentMatch = part.split(/\r?\n\r?\n/);
        if (contentMatch.length > 1) {
          textContent = contentMatch.slice(1).join('\n\n');

          // Check if it's quoted-printable encoded
          if (part.includes('quoted-printable')) {
            textContent = decodeQuotedPrintable(textContent);
          }
          break;
        }
      }
    }

    // Fall back to text/html if no text/plain
    if (!textContent) {
      for (const part of parts) {
        if (part.includes('Content-Type: text/html')) {
          const contentMatch = part.split(/\r?\n\r?\n/);
          if (contentMatch.length > 1) {
            textContent = contentMatch.slice(1).join('\n\n');

            if (part.includes('quoted-printable')) {
              textContent = decodeQuotedPrintable(textContent);
            }

            // Strip HTML tags
            textContent = textContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            break;
          }
        }
      }
    }
  } else {
    // Not multipart - extract body after headers
    const bodyParts = source.split(/\r?\n\r?\n/);
    if (bodyParts.length > 1) {
      textContent = bodyParts.slice(1).join('\n\n');

      // Check for quoted-printable in headers
      if (source.includes('quoted-printable')) {
        textContent = decodeQuotedPrintable(textContent);
      }
    }
  }

  // Strip the quoted original message (everything after "On ... wrote:")
  // Common patterns: "On Mon, Jan 1, 2025 at 12:00 PM, John wrote:"
  const quotedPatterns = [
    /\n\s*On .{10,80} wrote:\s*[\r\n>][\s\S]*/,        // "On ... wrote:" followed by quoted text
    /\n\s*On .{10,80} wrote:[\s\S]*$/,                 // "On ... wrote:" at end
    /\n\s*>[\s\S]*/,                                    // Lines starting with >
    /\n\s*-{3,}\s*Original Message\s*-{3,}[\s\S]*/i,   // --- Original Message ---
    /\n\s*From:\s+.+\nSent:\s+.+\nTo:\s+[\s\S]*/i,     // Outlook-style quote header
  ];

  for (const pattern of quotedPatterns) {
    textContent = textContent.replace(pattern, '');
  }

  // Clean up the result
  textContent = textContent
    .replace(/\r\n/g, '\n')        // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')    // Collapse multiple newlines
    .trim();

  return textContent;
};

/**
 * Extract text body from Gmail message payload
 */
const extractMessageBody = (payload: any): string => {
  // Check for direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Check parts for multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      // Prefer text/plain, fall back to text/html
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        // Strip HTML tags for plain text
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      }
      // Recurse into nested parts
      if (part.parts) {
        const nested = extractMessageBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
};

/**
 * Get thread details from Gmail API
 * Returns the number of messages in the thread and reply text
 */
const getThreadMessageCount = async (
  accessToken: string,
  threadId: string
): Promise<{ messageCount: number; hasReply: boolean; latestMessageFrom?: string; replyText?: string }> => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          format: "full", // Get full message including body
        },
      }
    );

    const thread = response.data as { messages?: any[] };
    const messages = thread.messages || [];
    const messageCount = messages.length;

    // If more than 1 message, check if the latest is from someone else (a reply)
    let hasReply = false;
    let latestMessageFrom: string | undefined;
    let replyText: string | undefined;

    if (messageCount > 1) {
      const latestMessage = messages[messages.length - 1];
      const headers = latestMessage.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");
      latestMessageFrom = fromHeader?.value;

      // It's a reply if the latest message is NOT from us
      // (We check if it's incoming by looking at labelIds)
      const labelIds = latestMessage.labelIds || [];
      hasReply = labelIds.includes("INBOX") || labelIds.includes("UNREAD");

      // Extract reply text if it's a reply
      if (hasReply && latestMessage.payload) {
        replyText = extractMessageBody(latestMessage.payload);
        // Truncate if too long (keep first 5000 chars)
        if (replyText && replyText.length > 5000) {
          replyText = replyText.substring(0, 5000) + '...';
        }
      }
    }

    return { messageCount, hasReply, latestMessageFrom, replyText };
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`[ReplyPoller] Thread ${threadId} not found (may have been deleted)`);
      return { messageCount: 0, hasReply: false };
    }
    throw error;
  }
};

/**
 * Check thread with automatic 401 retry
 */
const checkThreadWithRetry = async (
  accessToken: string,
  threadId: string,
  sender: SenderWithThreads,
  retried: boolean = false
): Promise<{ messageCount: number; hasReply: boolean; latestMessageFrom?: string; replyText?: string; newAccessToken?: string }> => {
  try {
    const result = await getThreadMessageCount(accessToken, threadId);
    return result;
  } catch (error: any) {
    // If 401 and we haven't retried yet, refresh token and retry
    if (error.response?.status === 401 && !retried && sender.refreshToken) {
      console.log(`[ReplyPoller] 🔄 Got 401, refreshing token for ${sender.senderEmail}...`);
      try {
        const newAccessToken = await refreshGoogleToken(sender.senderId, sender.refreshToken);
        const result = await getThreadMessageCount(newAccessToken, threadId);
        return { ...result, newAccessToken };
      } catch (refreshError: any) {
        console.error(`[ReplyPoller] ❌ Token refresh failed:`, refreshError.message);
        throw refreshError;
      }
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

  // Refresh token if expired or missing
  if (!accessToken || isTokenExpired(sender.tokenExpiry)) {
    if (!sender.refreshToken) {
      console.log(`[ReplyPoller] ⚠️ No refresh token for sender ${sender.senderEmail}, skipping`);
      return 0;
    }
    try {
      accessToken = await refreshGoogleToken(sender.senderId, sender.refreshToken);
    } catch (error: any) {
      console.error(`[ReplyPoller] ❌ Failed to refresh token for ${sender.senderEmail}:`, error.message);
      return 0;
    }
  }

  let repliesFound = 0;
  let tokenRefreshFailed = false;

  for (const thread of sender.threads) {
    // Skip remaining threads if token refresh already failed
    if (tokenRefreshFailed) {
      console.log(`[ReplyPoller] ⚠️ Skipping thread ${thread.threadId} due to previous auth failure`);
      continue;
    }

    try {
      console.log(`[ReplyPoller] Checking thread ${thread.threadId} for lead ${thread.leadEmail}`);

      const result = await checkThreadWithRetry(
        accessToken!,
        thread.threadId,
        sender
      );

      // Update accessToken if it was refreshed
      if (result.newAccessToken) {
        accessToken = result.newAccessToken;
      }

      console.log(`[ReplyPoller] Thread ${thread.threadId}: ${result.messageCount} messages, hasReply: ${result.hasReply}`);

      if (result.hasReply) {
        console.log(`[ReplyPoller] 🎉 Reply detected from ${result.latestMessageFrom}`);
        if (result.replyText) {
          console.log(`[ReplyPoller] Reply preview: ${result.replyText.substring(0, 100)}...`);
        }

        // Track the reply
        await EmailEventService.trackReplied({
          campaignId: thread.campaignId,
          leadId: thread.leadId,
          emailSendId: thread.emailSendId,
          isPositive: false, // You can add sentiment analysis later
        });

        // Mark EmailSend as having a reply and store reply text
        await prisma.emailSend.update({
          where: { id: thread.emailSendId },
          data: {
            status: EmailSendStatus.REPLIED,
            replyText: result.replyText || null,
            repliedAt: new Date(),
          },
        });

        repliesFound++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: any) {
      // Check if this is an auth error that we couldn't recover from
      if (error.message?.includes('REAUTH_REQUIRED') || error.response?.status === 401) {
        console.error(`[ReplyPoller] ❌ Auth failed for sender ${sender.senderEmail}, skipping remaining threads`);
        tokenRefreshFailed = true;
        continue;
      }
      console.error(`[ReplyPoller] ❌ Error checking thread ${thread.threadId}:`, error.message);
    }
  }

  return repliesFound;
};

/**
 * Poll for replies via IMAP for SMTP sender accounts
 * Looks for emails with In-Reply-To header matching our sent providerMsgId
 */
const pollRepliesForSmtpSender = async (sender: SmtpSenderWithEmails): Promise<number> => {
  console.log(`[ReplyPoller] [SMTP] Checking ${sender.emails.length} emails for sender ${sender.senderEmail}`);

  // Auto-detect secure based on port if misconfigured
  // Port 993 = SSL/TLS (secure=true), Port 143 = STARTTLS or plain (secure=false)
  const isSecure = sender.imapPort === 993 ? true : sender.imapSecure;

  console.log(`[ReplyPoller] [SMTP] IMAP config: host=${sender.imapHost}, port=${sender.imapPort}, secure=${isSecure}, user=${sender.imapUser}`);

  const client = new ImapFlow({
    host: sender.imapHost,
    port: sender.imapPort,
    secure: isSecure,
    auth: {
      user: sender.imapUser,
      pass: sender.imapPass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false, // Accept self-signed certs
    },
  });

  let repliesFound = 0;

  try {
    console.log(`[ReplyPoller] [SMTP] Connecting to IMAP...`);
    await client.connect();
    console.log(`[ReplyPoller] [SMTP] ✅ Connected to IMAP for ${sender.senderEmail}`);

    // Open INBOX
    await client.mailboxOpen("INBOX");

    // Build a set of message IDs we're looking for
    const messageIdMap = new Map<string, SmtpEmailInfo>();
    for (const email of sender.emails) {
      // Store with and without angle brackets for matching
      const cleanId = email.providerMsgId.replace(/^<|>$/g, "");
      messageIdMap.set(cleanId, email);
      messageIdMap.set(email.providerMsgId, email);
    }

    // Search for recent emails in INBOX (last 7 days)
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const messages = client.fetch(
      { since },
      { envelope: true, headers: ["in-reply-to", "references"], source: true }
    );

    for await (const msg of messages) {
      try {
        // Parse headers from Buffer
        const headersStr = msg.headers?.toString() || "";

        // Extract In-Reply-To and References headers
        const inReplyToMatch = headersStr.match(/in-reply-to:\s*([^\r\n]+)/i);
        const referencesMatch = headersStr.match(/references:\s*([^\r\n]+)/i);
        const inReplyTo = inReplyToMatch?.[1] || "";
        const references = referencesMatch?.[1] || "";

        // Check if any of our message IDs are referenced
        for (const [msgId, emailInfo] of messageIdMap) {
          if (inReplyTo.includes(msgId) || references.includes(msgId)) {
            console.log(`[ReplyPoller] [SMTP] Message matched ${msgId}`);

            let replyText: string | null = null;
            let sourceStr = "";

            if (msg.source) {
              sourceStr = msg.source.toString();
              replyText = extractReplyFromMimeSource(sourceStr);

              if (replyText && replyText.length > 5000) {
                replyText = replyText.substring(0, 5000) + "...";
              }
            }

            // 🚨 Detect bounce BEFORE tracking reply
            const isBounce = isBounceEmail(sourceStr, msg.headers);

            if (isBounce) {
              const bounceInfo = parseBounceEmail(replyText || "");

              console.log(
                `[ReplyPoller] [SMTP] 🚫 Bounce detected for ${emailInfo.emailSendId}`,
                bounceInfo
              );

              // Track bounce event
              await EmailEventService.trackBounced({
                campaignId: emailInfo.campaignId,
                leadId: emailInfo.leadId,
                emailSendId: emailInfo.emailSendId,
                // bounceReason: bounceInfo.message,
                // bounceType: bounceInfo.type,
              });

              // Update EmailSend
              await prisma.emailSend.update({
                where: { id: emailInfo.emailSendId },
                data: {
                  status: EmailSendStatus.BOUNCED,
                  // bounceReason: bounceInfo.message || null,
                  // bounceType: bounceInfo.type || null,
                  // bouncedAt: new Date(),
                },
              });

              messageIdMap.delete(msgId);
              break;
            }

            // ✅ Human reply
            console.log(
              `[ReplyPoller] [SMTP] 🎉 Human reply detected for ${msgId}`
            );

            await EmailEventService.trackReplied({
              campaignId: emailInfo.campaignId,
              leadId: emailInfo.leadId,
              emailSendId: emailInfo.emailSendId,
              isPositive: false,
            });

            await prisma.emailSend.update({
              where: { id: emailInfo.emailSendId },
              data: {
                status: EmailSendStatus.REPLIED,
                replyText,
                repliedAt: new Date(),
              },
            });

            repliesFound++;
            messageIdMap.delete(msgId);
            break;
          }
        }

      } catch (err: any) {
        console.error(`[ReplyPoller] [SMTP] Error processing message:`, err.message);
      }
    }

    await client.logout();
  } catch (error: any) {
    console.error(`[ReplyPoller] [SMTP] ❌ IMAP error for ${sender.senderEmail}:`, error.message);

    // Provide helpful hints based on error
    if (error.message?.includes("Unexpected close") || error.message?.includes("AUTHENTICATIONFAILED")) {
      console.error(`[ReplyPoller] [SMTP] 💡 Hint: For Gmail, use an App Password (not regular password). Enable IMAP in Gmail settings.`);
      console.error(`[ReplyPoller] [SMTP] 💡 Hint: Make sure port ${sender.imapPort} matches secure=${sender.imapSecure} (993=true, 143=false)`);
    }
  } finally {
    // Ensure client is closed
    try {
      await client.logout();
    } catch {
      // Ignore logout errors
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
    // Get all SENT EmailSend records
    const emailSends = await prisma.emailSend.findMany({
      where: {
        status: "SENT",
      },
      include: {
        sender: true,
        lead: true,
        campaign: true,
      },
      orderBy: { sentAt: "desc" },
    });

    // Count stats for debugging
    const gmailWithThread = emailSends.filter(e => e.sender?.provider === "gmail" && e.threadId).length;
    const smtpWithMsgId = emailSends.filter(e => e.sender?.provider === "smtp" && e.providerMsgId).length;
    console.log(`[ReplyPoller] 📊 SENT emails: ${gmailWithThread} Gmail (with threadId), ${smtpWithMsgId} SMTP (with messageId)`);

    if (emailSends.length === 0) {
      console.log(`[ReplyPoller] No emails to check`);
      console.log(`[ReplyPoller] ========== POLL END ==========\n`);
      return;
    }

    // Group Gmail senders (by threadId)
    const gmailSenderMap = new Map<string, SenderWithThreads>();
    // Group SMTP senders (by providerMsgId)
    const smtpSenderMap = new Map<string, SmtpSenderWithEmails>();

    for (const send of emailSends) {
      if (!send.sender || !send.lead || !send.campaign) continue;

      const senderId = send.sender.id;

      // Handle Gmail senders
      if (send.sender.provider === "gmail" && send.threadId) {
        if (!gmailSenderMap.has(senderId)) {
          gmailSenderMap.set(senderId, {
            senderId: send.sender.id,
            senderEmail: send.sender.email,
            accessToken: send.sender.accessToken,
            refreshToken: send.sender.refreshToken,
            tokenExpiry: send.sender.tokenExpiry,
            threads: [],
          });
        }

        gmailSenderMap.get(senderId)!.threads.push({
          emailSendId: send.id,
          threadId: send.threadId,
          campaignId: send.campaign.id,
          leadId: send.lead.id,
          leadEmail: send.lead.email,
          sentAt: send.sentAt || send.createdAt,
        });
      }

      // Handle SMTP senders (with IMAP config)
      if (send.sender.provider === "smtp" && send.providerMsgId) {
        const { imapHost, imapPort, imapUser, imapPass, imapSecure } = send.sender;

        // Only process if IMAP is configured
        if (imapHost && imapPort && imapUser && imapPass) {
          if (!smtpSenderMap.has(senderId)) {
            smtpSenderMap.set(senderId, {
              senderId: send.sender.id,
              senderEmail: send.sender.email,
              imapHost,
              imapPort,
              imapUser,
              imapPass,
              imapSecure: imapSecure ?? true,
              emails: [],
            });
          }

          smtpSenderMap.get(senderId)!.emails.push({
            emailSendId: send.id,
            providerMsgId: send.providerMsgId,
            campaignId: send.campaign.id,
            leadId: send.lead.id,
            leadEmail: send.lead.email,
            sentAt: send.sentAt || send.createdAt,
          });
        }
      }
    }

    console.log(`[ReplyPoller] Processing ${gmailSenderMap.size} Gmail account(s), ${smtpSenderMap.size} SMTP account(s)`);

    let totalReplies = 0;

    // Poll Gmail senders
    for (const [senderId, sender] of gmailSenderMap) {
      try {
        const replies = await pollRepliesForSender(sender);
        totalReplies += replies;
      } catch (error: any) {
        console.error(`[ReplyPoller] ❌ Error polling Gmail sender ${sender.senderEmail}:`, error.message);
      }
    }

    // Poll SMTP senders via IMAP
    for (const [senderId, sender] of smtpSenderMap) {
      try {
        const replies = await pollRepliesForSmtpSender(sender);
        totalReplies += replies;
      } catch (error: any) {
        console.error(`[ReplyPoller] ❌ Error polling SMTP sender ${sender.senderEmail}:`, error.message);
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
 * Runs every 1 minute
 */
export function startReplyPolling(intervalMinutes: number = 1): void {
  console.log(`[ReplyPoller] Starting reply polling every ${intervalMinutes} minutes`);

  // Run immediately on start
  pollForReplies();

  // Then run periodically
  setInterval(() => {
    pollForReplies();
  }, intervalMinutes * 60 * 1000);
}

function isBounceEmail(source: string, headers: any): boolean {
  const lower = source.toLowerCase();

  return (
    lower.includes("mailer-daemon") ||
    lower.includes("delivery status notification") ||
    lower.includes("address not found") ||
    lower.includes("undelivered mail") ||
    lower.includes("nxdomain") ||
    lower.includes("dns error") ||
    lower.includes("multipart/report") ||
    headers?.from?.value?.some((f: any) =>
      /mailer-daemon|postmaster/i.test(f.address)
    )
  );
}


// Export for manual testing
export { getThreadMessageCount, pollRepliesForSender };

