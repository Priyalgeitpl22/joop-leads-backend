import axios from "axios";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { EmailAccount, SenderAccount } from "../interfaces";
import { incrementCampaignCount } from "../controllers/analytics.controller";
import { AnalyticsCountType } from "../enums";

const prisma = new PrismaClient();

const isTokenExpired = (expiryDate?: number): boolean => {
  return expiryDate ? Date.now() >= expiryDate : true;
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
    if (error.response?.data?.error === 'invalid_grant') {
      console.error("[sendMail] ❌ Google OAuth Refresh Token Expired or Revoked");
      throw new Error("REAUTH_REQUIRED: Google OAuth refresh token has expired. Please re-authenticate.");
    }
    console.error("[sendMail] ❌ Google OAuth Token Refresh Error:", error.response?.data || error.message);
    throw new Error(`Failed to refresh Google OAuth token: ${error.response?.data?.error_description || error.message}`);
  }
};

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
  trackOpens: boolean
): Promise<{ id: string; threadId: string }> => {
  console.log("[sendMail] sendEmailFromGoogle called:", { toEmail, fromEmail, subject: subject.substring(0, 50) });

  if (!toEmail) {
    throw new Error("Recipient email is required!");
  }

  let access_token = account.accessToken || "";

  if (!access_token || isTokenExpired(account.tokenExpiry?.getTime())) {
    console.log("[sendMail] 🔄 Google token expired, refreshing...");
    access_token = await refreshGoogleOAuthToken(account);
  }

  const baseUrl = process.env.SERVER_URL || "http://localhost:5003/api";
  const trackingId = `${campaignId}_${leadId}`;

  // Build email content
  let emailContent: string;
  let contentType: string;

  if (isPlainText) {
    const stripHtmlTags = (html: string): string => html.replace(/<\/?[^>]+(>|$)/g, "");
    emailContent = stripHtmlTags(body);
    contentType = `text/plain; charset="UTF-8"`;
  } else {
    // Add tracking pixel if enabled
    const trackingPixel = trackOpens
      ? `<img src="${baseUrl}/track/open/${trackingId}" width="1" height="1" style="display:none;" />`
      : "";

    emailContent = `
      <html>
        <body>
          ${body}
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
    console.error("[sendMail] ❌ Google Email Error:", {
      toEmail,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });

    // Update bounce count
    incrementCampaignCount(campaignId, "bounced_count");

    throw new Error(`Failed to send email via Google: ${error.response?.data?.error?.message || error.message}`);
  }
};

const sendEmailFromMicrosoft = async (
  campaignId: string,
  account: SenderAccount,
  fromName: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<{ id: string }> => {
  console.log("[sendMail] sendEmailFromMicrosoft called:", { toEmail, subject: subject.substring(0, 50) });

  if (!toEmail) {
    throw new Error("Recipient email is required!");
  }

  let access_token = account.accessToken || "";
  if (!access_token || isTokenExpired(account.tokenExpiry?.getTime())) {
    console.log("[sendMail] 🔄 Microsoft token expired, refreshing...");
    const response = await refreshMicrosoftOAuthToken(account as unknown as EmailAccount);
    access_token = response.access_token;
  }

  const emailData = {
    message: {
      subject,
      body: { contentType: "HTML", content: body },
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

    incrementCampaignCount(campaignId, "bounced_count");
    throw new Error(`Failed to send email via Microsoft: ${error.response?.data?.error?.message || error.message}`);
  }
};

const sendEmailWithSMTP = async (
  campaignId: string,
  account: SenderAccount,
  fromName: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<{ id: string; messageId: string }> => {
  console.log("[sendMail] sendEmailWithSMTP called:", { toEmail, subject: subject.substring(0, 50) });

  if (!account.smtpHost || !account.smtpPort || !account.smtpUser || !account.smtpPass) {
    throw new Error("SMTP configuration is missing!");
  }
  if (!toEmail) {
    throw new Error("Recipient email is required!");
  }

  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpUser ? true : false,
    auth: {
      user: account.smtpUser,
      pass: account.smtpPass
    },
  });

  try {
    console.log("[sendMail] 📧 Sending email via SMTP...");

    const info = await transporter.sendMail({
      from: `${fromName} <${account.smtpUser}>`,
      to: toEmail,
      subject,
      html: body,
    });

    console.log("[sendMail] ✅ SMTP Email Sent to", toEmail, "MessageId:", info.messageId);
    incrementCampaignCount(campaignId, AnalyticsCountType.SENT_COUNT);

    return { id: info.messageId, messageId: info.messageId };
  } catch (error: any) {
    console.error("[sendMail] ❌ SMTP Email Error:", {
      toEmail,
      error: error.message,
      code: error.code,
    });

    incrementCampaignCount(campaignId, "bounced_count");
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
  trackOpens: boolean
): Promise<{ id: string; messageId?: string }> => {
  console.log("[sendMail] sendEmail called:", {
    campaignId,
    leadId,
    toEmail,
    provider: account.provider,
    subject: subject.substring(0, 50),
  });

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
          toEmail, subject, body, isPlainText, trackClicks, trackOpens
        );

      case "outlook":
        return await sendEmailFromMicrosoft(
          campaignId, account, fromName, toEmail, subject, body
        );

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
