import { EmailProvider, PrismaClient } from "@prisma/client";
import { sendEmail } from "../jobs/sendMail";

const prisma = new PrismaClient();

export interface SendResult {
  messageId: string | null;
  threadId: string | null;
}

/**
 * Process and send an email for a given EmailSend record
 * @param emailSendId - The EmailSend record ID
 * @returns The provider message ID and thread ID
 */
export async function processAndSendEmail(emailSendId: string): Promise<SendResult> {
  // 1. Fetch EmailSend with all related data
  const emailSend = await prisma.emailSend.findUnique({
    where: { id: emailSendId },
    include: {
      campaign: {
        include: {
          organization: true,
        },
      },
      lead: true,
      sender: true,
      sequence: true,
    },
  });

  if (!emailSend) {
    throw new Error(`EmailSend not found: ${emailSendId}`);
  }

  const { campaign, lead, sender, sequence } = emailSend;

  if (!campaign || !lead || !sender || !sequence) {
    throw new Error(`Missing required data for EmailSend: ${emailSendId}`);
  }

  const { subject, body } = processEmailTemplate(sequence, lead, campaign.sendAsPlainText);

  console.log(`[EmailSender] Sending email to ${lead.email} for campaign ${campaign.name}`);
  console.log(`[EmailSender] Subject: ${subject}`);
  console.log(`[EmailSender] Using sender: ${sender.email}`);

  // 4. Send the email
  const result = await sendEmail(
    campaign.id,
    lead.id,
    campaign.orgId,
    sender,
    lead.email,
    subject,
    body,
    campaign.sendAsPlainText || false,
    campaign.trackClicks ?? true,
    campaign.trackOpens ?? true,
    campaign.includeUnsubscribeLink ?? true,
    campaign.unsubscribeText || "Unsubscribe"
  );

  console.log(`[EmailSender] Email sent - messageId: ${result?.id}, threadId: ${result?.threadId}`);

  // Return both message ID and thread ID from the provider
  return {
    messageId: result?.id || result?.messageId || null,
    threadId: result?.threadId || null,
  };
}

/**
 * Process email template with lead variable replacements
 */
function processEmailTemplate(sequence: any, lead: any, sendAsPlainText: boolean): { subject: string; body: string } {
  let subject = sequence.subject || "No Subject";
  let body = sendAsPlainText ? sequence.bodyText : sequence.bodyHtml || "";

  // Build replacements from lead data
  const replacements: Record<string, string> = {
    "{{firstName}}": lead.firstName || "",
    "{{lastName}}": lead.lastName || "",
    "{{email}}": lead.email || "",
    "{{company}}": lead.company || "",
    "{{designation}}": lead.designation || "",
    "{{phone}}": lead.phone || "",
    "{{city}}": lead.city || "",
    "{{state}}": lead.state || "",
    "{{country}}": lead.country || "",
    "{{website}}": lead.website || "",
    // Full name helper
    "{{fullName}}": [lead.firstName, lead.lastName].filter(Boolean).join(" "),
  };

  // Replace all placeholders
  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g");
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  }

  return { subject, body };
}

/**
 * Get email preview without sending
 */
export async function getEmailPreview(emailSendId: string): Promise<{
  to: string;
  from: string;
  subject: string;
  body: string;
} | null> {
  const emailSend = await prisma.emailSend.findUnique({
    where: { id: emailSendId },
    include: {
      lead: true,
      sender: true,
      campaign: true,
      sequence: true,
    },
  });

  if (!emailSend || !emailSend.sequence || !emailSend.lead || !emailSend.sender) {
    return null;
  }

  const { subject, body } = processEmailTemplate(emailSend.sequence, emailSend.lead, emailSend.campaign?.sendAsPlainText ?? false);

  return {
    to: emailSend.lead.email,
    from: emailSend.sender.email,
    subject,
    body,
  };
}

