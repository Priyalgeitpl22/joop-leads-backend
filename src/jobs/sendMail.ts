import axios from "axios";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { EmailAccount } from "../interfaces";
import { incrementCampaignCount } from "../controllers/analytics.controller";

const prisma = new PrismaClient();
const isTokenExpired = (expiryDate?: number): boolean => {
  return expiryDate ? Date.now() >= expiryDate : true;
};

const refreshGoogleOAuthToken = async (account: EmailAccount): Promise<string> => {
  if (!account.oauth2.clientId || !account.oauth2.clientSecret || !account.oauth2.tokens.refresh_token) {
    throw new Error("Google OAuth2 credentials are missing!");
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  
  try {
    const response = await axios.post<{ access_token: string; expires_in: number }>(tokenUrl, null, {
      params: {
        client_id: account.oauth2.clientId,
        client_secret: account.oauth2.clientSecret,
        refresh_token: account.oauth2.tokens.refresh_token,
        grant_type: "refresh_token",
      },
    });

    if (!response.data.access_token) {
      throw new Error("Failed to refresh Google OAuth token");
    }

    account.oauth2.tokens.access_token = response.data.access_token;
    account.oauth2.tokens.expiry_date = Date.now() + response?.data?.expires_in * 1000;

    console.log("✅ Google Access Token Refreshed!");
    return account.oauth2.tokens.access_token;
  } catch (error: any) {
    // Check if the error is due to invalid/expired refresh token
    if (error.response?.data?.error === 'invalid_grant') {
      console.error("❌ Google OAuth Refresh Token Expired or Revoked");
      console.error("⚠️  The refresh token is no longer valid. User needs to re-authenticate.");
      throw new Error("REAUTH_REQUIRED: Google OAuth refresh token has expired or been revoked. Please re-authenticate your Google account.");
    }
    
    console.error("❌ Google OAuth Token Refresh Error:", error.response?.data || error.message);
    throw new Error(`Failed to refresh Google OAuth token: ${error.response?.data?.error_description || error.message}`);
  }
};

const refreshMicrosoftOAuthToken = async (
  account: EmailAccount
): Promise<{ access_token: string; expires_in: number }> => {
  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  try {
    if (!account?.oauth2?.tokens?.refresh_token) {
      throw new Error("❌ Microsoft OAuth2 refresh token is missing!");
    }

    const response = await axios.post<{ access_token: string; expires_in: number }>(
      tokenUrl,
      new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID as string,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET as string,
        refresh_token: account.oauth2.tokens.refresh_token,
        grant_type: "refresh_token",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!response.data?.access_token) {
      throw new Error("❌ Failed to retrieve access token from Microsoft OAuth!");
    }

    account.oauth2.tokens.access_token = response.data.access_token;
    account.oauth2.tokens.expiry_date = Date.now() + response.data.expires_in * 1000;

    console.log("✅ Microsoft Access Token Refreshed!");

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    };
  } catch (error: any) {
    console.error("❌ Microsoft OAuth Token Refresh Error:", error.response?.data || error.message);
    throw new Error(`❌ Failed to refresh Microsoft OAuth token: ${error.response?.data?.error_description || error.message}`);
  }
};

const sendEmailFromGoogle = async (
  campaignId: string,
  account: EmailAccount,
  fromName: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string,
  isPlainText: boolean,
  tracking: boolean,
  tarckingOpenEmail:boolean
): Promise<any> => {
  if (!toEmail) throw new Error("Recipient email is required!");

  let { access_token, expiry_date } = account.oauth2.tokens;
  if (!access_token || isTokenExpired(expiry_date)) {
    console.log("🔄 Google token expired, refreshing...");
    access_token = await refreshGoogleOAuthToken(account);
    account.oauth2.tokens.access_token = access_token;
  }

  const trackingId = `${campaignId}_${toEmail}`;
  const baseUrl = process.env.SERVER_URL || "http://localhost:5003/api";

  // Tracking links
  const trackingPixelUrl = `${baseUrl}/track/track-email/${trackingId}/opened_count`;
  const defaultRedirectUrl = "https://goldeneagle.ai/";

  let clickTrackingUrl = `${baseUrl}/track/track-email/${trackingId}/clicked_count?redirect=https://goldeneagle.ai/`;
  if (!tracking) {
    clickTrackingUrl = `${baseUrl}/track/track-email/${trackingId}/clicked_count?redirect=${defaultRedirectUrl}`;
  } else {
    clickTrackingUrl = defaultRedirectUrl;
  }
  const replyTrackingUrl = `mailto:${fromEmail}?subject=Re: ${encodeURIComponent(
    subject
  )}&body=Replying to your email`;
  let emailContent: string;
  let contentType: string;
  if (isPlainText) {
    const stripHtmlTags = (html: string): string =>
      html.replace(/<\/?[^>]+(>|$)/g, "");

    const plainBody = stripHtmlTags(body);
    emailContent = `${plainBody}\n\nVisit: ${clickTrackingUrl}\nReply: ${replyTrackingUrl}`;
    contentType = `text/plain; charset="UTF-8"`;
  } else {
    emailContent = `
      <html>
        <body>
          ${body}
          <br/><br/>
          <a href="${clickTrackingUrl}" target="_blank">Click here</a> to visit.
          <br/>
          <a href="${replyTrackingUrl}" target="_blank">Reply</a> to this email.
          <br/>
          ${tarckingOpenEmail ? `<img src="${trackingPixelUrl}" width="100px" height="100px" style="display:none;" />` : ''}
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


    // now set the send data to the prisma data base
    if(response.data){
      const {id} = response.data as {id:string,threadId:string}
      await prisma.trackEmails.create({data:{threadId:id,campaignId:campaignId,recipient:toEmail,sender_email:fromEmail}})
    }

    incrementCampaignCount(campaignId, "sent_count");
    console.log(
      `✅ Google Email Sent to ${toEmail}, Tracking ID: ${trackingId}`
    );
    return response.data;
  } catch (error: any) {
    console.log("One email counced");
    incrementCampaignCount(campaignId, "bounced_count");
    console.error(
      "❌ Google Email Error: Failed to send email to",
      toEmail,
      error.message
    );
  }
};

const sendEmailFromMicrosoft = async (campaignId: string, account: EmailAccount, fromName: string, toEmail: string, subject: string, body: string): Promise<any> => {

  let { access_token, expires_in } = account.oauth2.tokens;

  if (!toEmail) throw new Error("Recipient email is required!");
  if (access_token || isTokenExpired(expires_in)) {
    console.log("🔄 Microsoft token expired, refreshing...");
    const response = await refreshMicrosoftOAuthToken(account);
    access_token = response.access_token;
    expires_in = response.expires_in;
  }

  const emailData = {
    message: {
      subject,
      body: { contentType: "HTML", content: body },
      toRecipients: [{ emailAddress: { address: toEmail } }],
      from: fromName,
    },
    saveToSentItems: true,
  };

  try {
    const response = await axios.post(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      emailData,
      { headers: { Authorization: `Bearer ${account.oauth2.tokens.access_token}`, "Content-Type": "application/json" } }
    );

    console.log(`✅ Microsoft Email Sent to ${toEmail}`);
    return response.data;
  } catch (error) {
    incrementCampaignCount(campaignId, 'bounced_count');
    console.error("❌ Microsoft Email Error:", error);
    // throw new Error("Failed to send email via Microsoft");
  }
};

const sendEmailWithSMTP = async (campaignId: string, account: EmailAccount, fromName: string, toEmail: string, subject: string, body: string): Promise<any> => {
  if (!account.smtp) throw new Error("SMTP configuration is missing!");
  if (!toEmail) throw new Error("Recipient email is required!");

  const transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.smtp.auth.user, pass: account.smtp.auth.pass },
  });

  try {
    const info = await transporter.sendMail({
      from: `${fromName} <${account.smtp.auth.user}>`,
      to: toEmail,
      subject,
      html: body,
    });

    console.log(`✅ SMTP Email Sent to ${toEmail}`);
    return info;
  } catch (error) {
    incrementCampaignCount(campaignId, 'bounced_count');
    console.error("❌ SMTP Email Error:", error);
    // throw new Error("Failed to send email via SMTP");
  }
};

export const sendEmail = async (campaignId: string, orgId: string, account: EmailAccount, toEmail: string, subject: string, body: string,isPlainText:boolean,tarcking:boolean,tarckingOpenEmail:boolean): Promise<any> => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    if (!org || !org.name) throw new Error("Organization not found!");

    switch (account.type) {
      case "gmail":
        return sendEmailFromGoogle(campaignId, account, org.name, account.email, toEmail, subject, body,isPlainText,tarcking,tarckingOpenEmail);
      case "outlook":
        return sendEmailFromMicrosoft(campaignId, account, org.name, toEmail, subject, body);
      case "imap":
        return sendEmailWithSMTP(campaignId, account, org.name, toEmail, subject, body);
      default:
        throw new Error("Invalid email provider type!");
    }
  } catch (error) {
    console.error(`❌ Failed to send email to ${toEmail}:`, error);
    throw new Error("Email sending failed");
  }
};

