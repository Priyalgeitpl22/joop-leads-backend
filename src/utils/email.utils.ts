import nodemailer from 'nodemailer';

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// =====================================================
// EMAIL TRACKING UTILITIES
// =====================================================

const BASE_URL = process.env.SERVER_URL || "http://localhost:5003/api";

/**
 * Generate tracking ID from campaignId and leadId
 * Format: campaignId_leadId
 */
export const generateTrackingId = (campaignId: string, leadId: string): string => {
  return `${campaignId}_${leadId}`;
};

/**
 * Generate open tracking pixel HTML
 * This invisible image is loaded when the email is opened
 */
export const generateOpenTrackingPixel = (campaignId: string, leadId: string): string => {
  const trackingId = generateTrackingId(campaignId, leadId);
  return `<img src="${BASE_URL}/track/open/${trackingId}" width="1" height="1" style="display:none;visibility:hidden;" alt="" />`;
};

/**
 * Generate click tracking URL
 * Wraps the original URL to track clicks
 */
export const generateClickTrackingUrl = (
  campaignId: string,
  leadId: string,
  originalUrl: string
): string => {
  const trackingId = generateTrackingId(campaignId, leadId);
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${BASE_URL}/track/click/${trackingId}?url=${encodedUrl}`;
};

/**
 * Generate unsubscribe URL
 */
export const generateUnsubscribeUrl = (campaignId: string, leadId: string): string => {
  const trackingId = generateTrackingId(campaignId, leadId);
  return `${BASE_URL}/track/unsubscribe/${trackingId}`;
};

/**
 * Replace all links in HTML with click tracking URLs
 * Preserves mailto: and tel: links
 */
export const replaceLinksWithTracking = (
  html: string,
  campaignId: string,
  leadId: string
): string => {
  // Regex to match href attributes with http/https URLs
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;

  return html.replace(linkRegex, (match, url) => {
    // Skip if it's already a tracking URL
    if (url.includes("/track/click/")) {
      return match;
    }

    const trackingUrl = generateClickTrackingUrl(campaignId, leadId, url);
    return `href="${trackingUrl}"`;
  });
};

/**
 * Add all tracking to email HTML body
 * - Replaces links with click tracking URLs
 * - Adds open tracking pixel
 * - Adds unsubscribe link if enabled
 */
export const addTrackingToEmail = (
  html: string,
  campaignId: string,
  leadId: string,
  options: {
    trackOpens?: boolean;
    trackClicks?: boolean;
    includeUnsubscribe?: boolean;
    unsubscribeText?: string;
  } = {}
): string => {
  const {
    trackOpens = true,
    trackClicks = true,
    includeUnsubscribe = true,
    unsubscribeText = "Unsubscribe",
  } = options;

  let processedHtml = html;

  // Replace links with tracking URLs
  if (trackClicks) {
    processedHtml = replaceLinksWithTracking(processedHtml, campaignId, leadId);
  }

  // Add unsubscribe link
  if (includeUnsubscribe) {
    const unsubscribeUrl = generateUnsubscribeUrl(campaignId, leadId);
    const unsubscribeHtml = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
        <a href="${unsubscribeUrl}" style="color: #666;">${unsubscribeText}</a>
      </div>
    `;
    processedHtml += unsubscribeHtml;
  }

  // Add open tracking pixel (at the very end)
  if (trackOpens) {
    processedHtml += generateOpenTrackingPixel(campaignId, leadId);
  }

  return processedHtml;
};

const getTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  if (!emailUser || !emailPassword) {
    throw new Error('EMAIL_USER and EMAIL_PASSWORD environment variables are required');
  }

  return nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

export const sendOtpEmail = async (email: string, otp: string) => {
  const emailUser = process.env.EMAIL_USER;

  if (!emailUser) {
    throw new Error('EMAIL_USER environment variable is required');
  }
  const mailOptions = {
    from: emailUser,
    to: email,
    subject: 'OTP Verification',
    text: `Your OTP is ${otp}`,
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully');
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

export const sendActivationEmail = async (email: string, fullName: string, activationLink: string) => {
  try {
    const emailUser = process.env.EMAIL_USER;

    if (!emailUser) {
      throw new Error('EMAIL_USER environment variable is required');
    }

    const mailOptions = {
      from: emailUser,
      to: email,
      subject: "Activate Your Account",
      html: `
            <p>Hello ${fullName},</p>
            <p>Your account has been created. Please activate your account by setting up a password.</p>
            <p><a href="${activationLink}">Click here to activate your account</a></p>
            <p>The link will expire in 1 hour.</p>
        `,
    };

    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending activation email:', error);
    throw error;
  }
};

export const resendActivationEmail = async (email: string, fullName: string, activationLink: string) => {
  try {
    const emailUser = process.env.EMAIL_USER;

    if (!emailUser) {
      throw new Error("EMAIL_USER environment variable is required");
    }

    const mailOptions = {
      from: emailUser,
      to: email,
      subject: "Resend: Activate Your Account",
      html: `
        <p>Hello ${fullName},</p>
        <p>We noticed that your account is not activated yet.</p>
        <p>Please activate your account by setting up your password using the link below:</p>
        <p>
          <a href="${activationLink}" style="color: #034f84; font-weight: 600;">
            Click here to activate your account
          </a>
        </p>
        <p>This activation link will expire in 1 hour.</p>
        <p>If you did not request this email, you can safely ignore it.</p>
      `,
    };

    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error resending activation email:", error);
    throw error;
  }
};

export const sendResetPasswordEmail = async (email: string, fullName: string, resetPasswordLink: string) => {
  const emailUser = process.env.EMAIL_USER;

  if (!emailUser) {
    throw new Error('EMAIL_USER environment variable is required');
  }

  const mailOptions = {
    from: emailUser,
    to: email,
    subject: "Reset Your Account Password",
    html: `
          <p>Hi ${fullName},</p>
          <p>We received a request to reset your password. Click the link below to set up a new one:</p>
          <p><a href="${resetPasswordLink}">Reset Password</a></p>
          <p>This link is valid for the next 60 minutes.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>Best regards,</p>
          <p>Your Support Team</p>
      `,
  };

  const transporter = getTransporter();
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending reset password email:', error);
    throw error;
  }
};

  export const subscriptionActivationEmail = async (planCode: string, billingPeriod: string, addOns: { name: string; code: string }[], organizationName: string = '', contactEmail: string = '', totalCost: number) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'priyal@goldeneagle.ai';
  const emailUser = process.env.EMAIL_USER;

  if (!emailUser) {
    throw new Error('ADMIN_EMAIL and ADMIN_NAME environment variables are required');
  }

  const mailOptions = {
    from: emailUser,
    to: adminEmail,
    subject: "Subscription Activation Request",
    html: `
      <p>Hello Admin,</p>
      <p>We have received a request to activate a subscription for ${organizationName} organization.</p>
      <p>Plan Code: ${planCode}</p>
      <p>Billing Period: ${billingPeriod}</p>
      ${addOns.length > 0 ? `<p>Add-Ons: ${addOns.map((addOn) => addOn.name).join(', ')}</p>` : 'None'}
      <p>Total billing amount: ${totalCost}$</p>
      <p>Contact Email: ${contactEmail}</p>
      <p>Best regards,</p>
      <p>Your Support Team</p>
    `,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};

export const calculateDelayMs = (totalEmails: number) => {
  const base = Math.ceil(totalEmails / 10) * 1000;
  const min = 5_000;
  const max = 10 * 60 * 1000; // 10 min cap

  return Math.min(Math.max(base, min), max);
}

export function getPollingConfig(totalEmails: number) {
  if (totalEmails <= 500) {
    return {
      intervalMs: 10_000,   // every 10 sec
      maxAttempts: 60,      // ~10 min
    };
  }

  if (totalEmails <= 5_000) {
    return {
      intervalMs: 20_000,
      maxAttempts: 90,      // ~30 min
    };
  }

  return {
    intervalMs: 30_000,
    maxAttempts: 200,      // ~100 min
  };
}

export const subscriptionExpiryReminderEmail = async (
  toEmail: string,
  orgName: string,
  planName: string,
  expiryDate: Date,
  daysRemaining: number,
  renewalLink: string
): Promise<void> => {
  const emailUser = process.env.EMAIL_USER;

  if (!emailUser) {
    throw new Error("EMAIL_USER environment variable is required");
  }

  const formattedExpiry = expiryDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const urgencyColor =
    daysRemaining <= 1 ? "#e53e3e" : daysRemaining <= 5 ? "#dd6b20" : "#3182ce";

  const urgencyLabel =
    daysRemaining === 1
      ? "⚠️ Your subscription expires tomorrow"
      : `⚠️ Your subscription expires in ${daysRemaining} days`;

  const subject = `${urgencyLabel} — ${planName} Plan`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8" /></head>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background-color: ${urgencyColor}; padding: 24px 32px;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">${urgencyLabel}</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="font-size: 16px; color: #333333; margin-top: 0;">
                      Hi <strong>${orgName}</strong>,
                    </p>
                    <p style="font-size: 16px; color: #333333;">
                      Your <strong>${planName}</strong> subscription is set to expire on
                      <strong style="color: ${urgencyColor};">${formattedExpiry}</strong>.
                    </p>
                    <p style="font-size: 16px; color: #555555;">
                      To avoid any interruption to your service, please renew before the expiry date.
                    </p>

                    <!-- CTA Button -->
                    <table cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                      <tr>
                        <td style="background-color: ${urgencyColor}; border-radius: 6px; padding: 14px 28px;">
                          <a href="${renewalLink}" style="color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none;">
                            Renew Subscription →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size: 14px; color: #888888;">
                      If you have already renewed or have any questions, please contact our support team.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px 32px; border-top: 1px solid #eeeeee;">
                    <p style="font-size: 12px; color: #aaaaaa; margin: 0; text-align: center;">
                      You're receiving this because you're an admin of <strong>${orgName}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from: emailUser,
      to: toEmail,
      subject,
      html,
    });
    console.log(`[subscriptionExpiryReminderEmail] ✅ Sent to ${toEmail} — "${subject}"`);
  } catch (error) {
    console.error(`[subscriptionExpiryReminderEmail] ❌ Failed to send to ${toEmail}:`, error);
    throw error;
  }
};