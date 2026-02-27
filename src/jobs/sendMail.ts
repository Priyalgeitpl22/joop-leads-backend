import axios from "axios";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { EmailAccount, SenderAccount } from "../interfaces";
import { incrementCampaignCount } from "../controllers/analytics.controller";
import { AnalyticsCountType } from "../enums";
import { InboxEngineApiService } from "../services/inbox.engine.service";
import { EmailAccountState } from "../models/email.account.model";
import { SenderAccountState } from "../models/enums";

const prisma = new PrismaClient();

const isTokenExpired = (expiryDate?: Date): boolean => {
  return expiryDate ? Date.now() >= expiryDate.getTime() : true;
};

const resolveReplyTo = (account: SenderAccount): string => {
  const replyTo = account.replyTo?.trim().toLowerCase();

  if (replyTo) {
    return replyTo;
  }

  return account.smtpUser ?? "";
};

const decodeHtmlEntities = (text: string): string => {
  let decoded = text.replace(/&amp;(#?\w+);/gi, "&$1;");

  const entities: Record<string, string> = {
    'nbsp': ' ',
    'amp': '&',
    'lt': '<',
    'gt': '>',
    'quot': '"',
    'apos': "'",
    '#39': "'",
    'copy': '©',
    'reg': '®',
    'trade': '™',
    'hellip': '…',
    'mdash': '—',
    'ndash': '–',
    'lsquo': '\u2018',
    'rsquo': '\u2019',
    'ldquo': '\u201C',
    'rdquo': '\u201D',
    'bull': '•',
  };

  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(`&${entity};`, 'gi'), char);
  }

  decoded = decoded.replace(/&#(\d+);/gi, (_, code) =>
    String.fromCharCode(parseInt(code, 10))
  );

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  decoded = decoded.replace(/\u00A0/g, ' ');

  return decoded;
};

const htmlToPlainText = (html: string): string => {
  let text = html;

  console.log("[htmlToPlainText] Input:", text.substring(0, 200));

  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");

  text = text.replace(/<[^>]+>/g, "");

  text = decodeHtmlEntities(text);
  text = decodeHtmlEntities(text);

  text = text.replace(/[ \t]+/g, " ");  // Multiple spaces/tabs to single space
  text = text.replace(/\n[ \t]+/g, "\n");  // Remove leading spaces on lines
  text = text.replace(/[ \t]+\n/g, "\n");  // Remove trailing spaces on lines
  text = text.replace(/\n{3,}/g, "\n\n");  // Max 2 consecutive newlines
  text = text.trim();

  console.log("[htmlToPlainText] Output:", text.substring(0, 200));

  return text;
};

const replaceLinksWithTracking = (
  html: string,
  baseUrl: string,
  trackingId: string
): string => {
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;

  return html.replace(linkRegex, (match, url) => {
    if (url.includes("/track/click/") || url.includes("/track/unsubscribe/")) {
      return match;
    }

    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${baseUrl}/track/click/${trackingId}?url=${encodedUrl}`;
    return `href="${trackingUrl}"`;
  });
};

const refreshGoogleOAuthToken = async (account: SenderAccount): Promise<string> => {
  console.log("[sendMail] refreshGoogleOAuthToken called for:", account.email);

  if (!account.accessToken || !account.refreshToken || !account.tokenExpiry) {
    const error = new Error("Google OAuth2 credentials are missing!");
    console.error("[sendMail] ❌ Missing OAuth credentials:", {
      hasAccessToken: !!account.accessToken,
      hasRefreshToken: !!account.refreshToken,
      hasTokenExpiry: !!account.tokenExpiry,
      accountEmail: account.email,
      accountId: account.id
    });
    throw error;
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const refreshTokenPreview = account.refreshToken?.substring(0, 20) + "...";
  console.log("[sendMail] 🔄 Refreshing Google OAuth token for:", account.email);
  console.log("[sendMail] 🔍 Refresh token preview:", refreshTokenPreview);

  try {
    const response = await axios.post<{ access_token: string; expires_in: number }>(tokenUrl, null, {
      params: {
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        refresh_token: account.refreshToken as string,
        grant_type: "refresh_token",
      },
    });

    if (!response.data.access_token) {
      throw new Error("Failed to refresh Google OAuth token - no access_token in response");
    }

    account.accessToken = response.data.access_token;
    account.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);

    console.log("[sendMail] ✅ Google Access Token Refreshed!");
    return account.accessToken as string;
  } catch (error: any) {
    const errorReason = error.response?.data?.error || "error_unknown";
    console.error("[sendMail] ❌ Google OAuth Refresh Token Expired or Revoked");
    await InboxEngineApiService.updateSenderAccountState(
      account.accountId as string,
      SenderAccountState.REAUTH_REQUIRED,
      errorReason,
      { message: error?.message ?? "Refresh token expired or revoked", provider: "google" }
    );
    throw new Error("REAUTH_REQUIRED: Google OAuth refresh token has expired. Please re-authenticate.");
  }
};

function isReauthRequired(error: any) {
  const message = error?.response?.data?.error_description || error?.message || "";
  return (
    message.includes("invalid_grant") ||
    message.includes("REAUTH_REQUIRED") ||
    message.includes("Token has been expired or revoked")
  );
}

const refreshMicrosoftOAuthToken = async (account: EmailAccount): Promise<{ access_token: string; expires_in: number }> => {
  console.log("[sendMail] refreshMicrosoftOAuthToken called for:", account.email);

  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  if (!account?.oauth2?.tokens?.refresh_token) {
    throw new Error("Microsoft OAuth2 refresh token is missing!");
  }

  try {
    const response = await axios.post<{ access_token: string; expires_in: number }>(
      tokenUrl,
      new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID as string,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET as string,
        refresh_token: account.oauth2.tokens.refresh_token,
        grant_type: "refresh_token",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    if (!response.data?.access_token) {
      throw new Error("Failed to retrieve access token from Microsoft OAuth!");
    }

    account.oauth2.tokens.access_token = response.data.access_token;
    account.oauth2.tokens.expiry_date = Date.now() + response.data.expires_in * 1000;

    console.log("[sendMail] ✅ Microsoft Access Token Refreshed!");
    return response.data;
  } catch (error: any) {
    console.error("[sendMail] ❌ Microsoft OAuth Token Refresh Error:", error.response?.data || error.message);
    throw new Error(`Failed to refresh Microsoft OAuth token: ${error.response?.data?.error_description || error.message}`);
  }
};

const sendEmailFromGoogle = async (
  campaignId: string,
  leadId: string,
  account: SenderAccount,
  fromName: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string,
  isPlainText: boolean,
  trackClicks: boolean,
  trackOpens: boolean,
  includeUnsubscribeLink: boolean,
  unsubscribeText: string
): Promise<{ id: string; threadId: string }> => {
  console.log("[sendMail] sendEmailFromGoogle called:", { toEmail, fromEmail, subject: subject.substring(0, 50) });

  if (!toEmail) {
    throw new Error("Recipient email is required!");
  }

  let access_token = account.accessToken || "";

  if (!access_token || isTokenExpired(account.tokenExpiry as Date)) {
    console.log("[sendMail] 🔄 Google token expired, refreshing...");
    access_token = await refreshGoogleOAuthToken(account);
  }

  const baseUrl = process.env.SERVER_URL || "http://localhost:5003/api";
  const trackingId = `${campaignId}_${leadId}`;

  // Build email content
  let emailContent: string;
  let contentType: string;

  if (isPlainText) {
    // Add unsubscribe text for plain text emails
    const unsubscribeTextContent = includeUnsubscribeLink
      ? `\n\n${unsubscribeText}: ${baseUrl}/track/unsubscribe/${trackingId}`
      : "";
    emailContent = htmlToPlainText(body) + unsubscribeTextContent;
    contentType = `text/plain; charset="UTF-8"`;
  } else {
    // Replace links with click tracking URLs if enabled
    let processedBody = body;
    if (trackClicks) {
      processedBody = replaceLinksWithTracking(body, baseUrl, trackingId);
    }

    // Add unsubscribe link if enabled
    const unsubscribeHtml = includeUnsubscribeLink
      ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
          <a href="${baseUrl}/track/unsubscribe/${trackingId}" style="color: #666;">${unsubscribeText}</a>
        </div>`
      : "";

    // Add tracking pixel if enabled
    const trackingPixel = trackOpens
      ? `<img src="${baseUrl}/track/open/${trackingId}" width="1" height="1" style="display:none;" />`
      : "";

    emailContent = `
      <html>
        <body>
          ${processedBody}
          ${unsubscribeHtml}
          ${trackingPixel}
        </body>
      </html>
    `;
    contentType = `text/html; charset="UTF-8"`;
  }

  const encodedMessage = Buffer.from(
    `From: "${fromName}" <${fromEmail}>\r\n` +
    `To: <${toEmail}>\r\n` +
    `Subject: ${subject}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n` +
    emailContent
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    console.log("[sendMail] 📧 Sending email via Gmail API...");

    const response = await axios.post(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      { raw: encodedMessage },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data as { id: string; threadId: string };
    console.log("[sendMail] ✅ Google Email Sent to", toEmail, "MessageId:", result.id);

    // Update analytics
    incrementCampaignCount(campaignId, AnalyticsCountType.SENT_COUNT);

    return result;
  } catch (error: any) {
    incrementCampaignCount(campaignId, AnalyticsCountType.BOUNCED_COUNT);
    console.error("[sendMail] ❌ Google Email Error:", {
      toEmail,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });
    await InboxEngineApiService.updateSenderAccountState(
      account.accountId as string,
      SenderAccountState.REAUTH_REQUIRED,
      "REAUTH_REQUIRED",
      {
        message: error?.message ?? "Send failed",
        status: error.response?.status,
        toEmail,
        provider: "google",
      }
    );
    throw new Error("REAUTH_REQUIRED: Google OAuth refresh token has expired. Please re-authenticate.");
  }
};

const sendEmailFromMicrosoft = async (
  campaignId: string,
  leadId: string,
  account: SenderAccount,
  fromName: string,
  toEmail: string,
  subject: string,
  body: string,
  isPlainText: boolean,
  trackClicks: boolean,
  trackOpens: boolean,
  includeUnsubscribeLink: boolean,
  unsubscribeText: string
): Promise<{ id: string }> => {
  console.log("[sendMail] sendEmailFromMicrosoft called:", { toEmail, subject: subject.substring(0, 50) });

  if (!toEmail) {
    throw new Error("Recipient email is required!");
  }

  let access_token = account.accessToken || "";
  if (!access_token || isTokenExpired(account.tokenExpiry as Date)) {
    console.log("[sendMail] 🔄 Microsoft token expired, refreshing...");
    try {
      const response = await refreshMicrosoftOAuthToken(account as unknown as EmailAccount);
      access_token = response.access_token;
    } catch (error: any) {
      await InboxEngineApiService.updateSenderAccountState(
        account.accountId as string,
        SenderAccountState.REAUTH_REQUIRED,
        "TOKEN_REFRESH_FAILED",
        { message: error?.message ?? "Microsoft token refresh failed", provider: "microsoft" }
      );
      throw error;
    }
  }

  // Build email content with tracking
  const baseUrl = process.env.SERVER_URL || "http://localhost:5003/api";
  const trackingId = `${campaignId}_${leadId}`;

  let emailContent: string;
  let contentType: "Text" | "HTML";

  if (isPlainText) {
    // Add unsubscribe text for plain text emails
    const unsubscribeTextContent = includeUnsubscribeLink
      ? `\n\n${unsubscribeText}: ${baseUrl}/track/unsubscribe/${trackingId}`
      : "";
    emailContent = htmlToPlainText(body) + unsubscribeTextContent;
    contentType = "Text";
  } else {
    // Replace links with click tracking URLs if enabled
    let processedBody = body;
    if (trackClicks) {
      processedBody = replaceLinksWithTracking(body, baseUrl, trackingId);
    }

    // Add unsubscribe link if enabled
    const unsubscribeHtml = includeUnsubscribeLink
      ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
          <a href="${baseUrl}/track/unsubscribe/${trackingId}" style="color: #666;">${unsubscribeText}</a>
        </div>`
      : "";

    // Add tracking pixel if enabled
    const trackingPixel = trackOpens
      ? `<img src="${baseUrl}/track/open/${trackingId}" width="1" height="1" style="display:none;" />`
      : "";

    emailContent = `
      <html>
        <body>
          ${processedBody}
          ${unsubscribeHtml}
          ${trackingPixel}
        </body>
      </html>
    `;
    contentType = "HTML";
  }

  const emailData = {
    message: {
      subject,
      body: { contentType, content: emailContent },
      toRecipients: [{ emailAddress: { address: toEmail } }],
    },
    saveToSentItems: true,
  };

  try {
    console.log("[sendMail] 📧 Sending email via Microsoft Graph API...");

    const response = await axios.post(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      emailData,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("[sendMail] ✅ Microsoft Email Sent to", toEmail);
    incrementCampaignCount(campaignId, AnalyticsCountType.SENT_COUNT);

    return { id: response.headers["message-id"] || "sent" };
  } catch (error: any) {
    console.error("[sendMail] ❌ Microsoft Email Error:", {
      toEmail,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });
    incrementCampaignCount(campaignId, AnalyticsCountType.BOUNCED_COUNT);
    await InboxEngineApiService.updateSenderAccountState(
      account.accountId as string,
      SenderAccountState.REAUTH_REQUIRED,
      "SEND_FAILED",
      {
        message: error?.message ?? "Send failed",
        status: error.response?.status,
        toEmail,
        provider: "microsoft",
      }
    );
    throw new Error(`Failed to send email via Microsoft: ${error.response?.data?.error?.message || error.message}`);
  }
};

const sendEmailWithSMTP = async (
  campaignId: string,
  leadId: string,
  account: SenderAccount,
  fromName: string,
  toEmail: string,
  subject: string,
  body: string,
  isPlainText: boolean,
  trackClicks: boolean,
  trackOpens: boolean,
  includeUnsubscribeLink: boolean,
  unsubscribeText: string
): Promise<{ id: string; messageId: string }> => {
  console.log("[sendMail] sendEmailWithSMTP called:", { toEmail, subject: subject.substring(0, 50) });

  if (!account.smtpHost || !account.smtpPort || !account.smtpUser || !account.smtpPass) {
    throw new Error("SMTP configuration is missing!");
  }
  if (!toEmail) {
    throw new Error("Recipient email is required!");
  }

  const isSecure = account.smtpSecure ?? (account.smtpPort === 465);

  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: isSecure,
    auth: {
      user: account.smtpUser,
      pass: account.smtpPass
    },
  });

  // Build email content with tracking
  const baseUrl = process.env.SERVER_URL || "http://localhost:5003/api";
  const trackingId = `${campaignId}_${leadId}`;

  let emailContent: string;

  if (isPlainText) {
    // Add unsubscribe text for plain text emails
    const unsubscribeTextContent = includeUnsubscribeLink
      ? `\n\n${unsubscribeText}: ${baseUrl}/track/unsubscribe/${trackingId}`
      : "";
    emailContent = htmlToPlainText(body) + unsubscribeTextContent;
  } else {
    // Replace links with click tracking URLs if enabled
    let processedBody = body;
    if (trackClicks) {
      processedBody = replaceLinksWithTracking(body, baseUrl, trackingId);
    }

    // Add unsubscribe link if enabled
    const unsubscribeHtml = includeUnsubscribeLink
      ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
          <a href="${baseUrl}/track/unsubscribe/${trackingId}" style="color: #666;">${unsubscribeText}</a>
        </div>`
      : "";

    // Add tracking pixel if enabled
    const trackingPixel = trackOpens
      ? `<img src="${baseUrl}/track/open/${trackingId}" width="1" height="1" style="display:none;" />`
      : "";

    emailContent = `
      <html>
        <body>
          ${processedBody}
          ${unsubscribeHtml}
          ${trackingPixel}
        </body>
      </html>
    `;
  }

  try {
    console.log("[sendMail] 📧 Sending email via SMTP...");
    const replyToEmail = resolveReplyTo(account);

    const mailOptions: any = {
      from: `${fromName} <${account.smtpUser}>`,
      to: toEmail,
      subject,
      replyTo: replyToEmail,
    };

    if (isPlainText) {
      mailOptions.text = emailContent;
    } else {
      mailOptions.html = emailContent;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("[sendMail] ✅ SMTP Email Sent to", toEmail, "MessageId:", info.messageId);
    incrementCampaignCount(campaignId, AnalyticsCountType.SENT_COUNT);

    return { id: info.messageId, messageId: info.messageId };
  } catch (error: any) {
    await InboxEngineApiService.updateSenderAccountState(
      account.accountId as string,
      SenderAccountState.REAUTH_REQUIRED,
      "SEND_FAILED",
      {
        message: error?.message ?? "Send failed",
        status: error.response?.status ?? error.responseCode,
        toEmail,
        provider: "smtp",
      }
    );

    console.error("[sendMail] ❌ SMTP Email Error:", {
      toEmail,
      error: error.message,
      code: error.code,
    });

    incrementCampaignCount(campaignId, AnalyticsCountType.BOUNCED_COUNT);
    throw new Error(`Failed to send email via SMTP: ${error.message}`);
  }
};

export const sendEmail = async (
  campaignId: string,
  leadId: string,
  orgId: string,
  account: SenderAccount,
  toEmail: string,
  subject: string,
  body: string,
  isPlainText: boolean,
  trackClicks: boolean,
  trackOpens: boolean,
  includeUnsubscribeLink: boolean = true,
  unsubscribeText: string = "Unsubscribe"
): Promise<{ id: string; messageId?: string; threadId?: string }> => {

  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    if (!org || !org.name) {
      throw new Error(`Organization not found: ${orgId}`);
    }

    const fromName = org.name;

    switch (account.provider) {
      case "gmail":
        return await sendEmailFromGoogle(
          campaignId, leadId, account, fromName, account.email,
          toEmail, subject, body, isPlainText, trackClicks, trackOpens,
          includeUnsubscribeLink, unsubscribeText
        );

      case "outlook":
        return await sendEmailFromMicrosoft(
          campaignId, leadId, account, fromName, toEmail, subject, body,
          isPlainText, trackClicks, trackOpens,
          includeUnsubscribeLink, unsubscribeText
        );

      case "smtp":
        return await sendEmailWithSMTP(
          campaignId, leadId, account, fromName, toEmail, subject, body,
          isPlainText, trackClicks, trackOpens,
          includeUnsubscribeLink, unsubscribeText
        )
      default:
        throw new Error(`Invalid email provider type: ${account.provider}`);
    }
  } catch (error: any) {
    console.error("[sendMail] ❌ sendEmail failed:", {
      campaignId,
      leadId,
      toEmail,
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw to let caller handle
  }
};
