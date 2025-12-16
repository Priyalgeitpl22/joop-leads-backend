import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { EmailAccount, Sequence } from "../interfaces";
import { DateTime } from "luxon";
import { sendEmail } from "./sendMail";

const prisma = new PrismaClient();

const replaceTemplateVariables = (template: string, variables: any) => {
  return template.replace(/{{(.*?)}}/g, (_, key) => variables[key.trim()] || "");
};

cron.schedule("*/1 * * * *", async () => {
  console.log("🔄 Running campaign email cron job...");

  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          { status: "SCHEDULED" },
          { status: "RUNNING" }
        ]
      },
      include: {
        sequences: true,
        email_campaign_settings: true,
        emailCampaigns: { include: { contact: true } },
      },
    });

    const eligibleCampaigns = campaigns.filter((campaign) => {
      const schedule = campaign.email_campaign_settings?.[0]?.campaign_schedule as any;

      if (!schedule) {
        console.log(`⚠️ Campaign ${campaign.id} has no schedule.`);
        return false;
      }

      try {
        const { startDate, startTime, selectedDays } = schedule;
        const campaignStart = new Date(startDate);
        const campaignStartTime = new Date(startTime);
        const nowUTC = new Date();

        const isStarted = nowUTC >= campaignStartTime;
        const currentDay = nowUTC.getUTCDay() === 0 ? 7 : nowUTC.getUTCDay();
        const isCorrectDay = selectedDays.length === 0 || selectedDays.includes(currentDay);

        return isStarted && isCorrectDay;
      } catch (error) {
        console.error(`❌ Error checking campaign ${campaign.id}:`, error);
        return false;
      }
    });

    console.log(`✅ Found ${eligibleCampaigns.length} eligible campaigns.`);

    for (const campaign of eligibleCampaigns) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "RUNNING" },
      });

      for (const emailCampaign of campaign.emailCampaigns) {
        const contact = emailCampaign.contact;
        if (!contact || !contact.email) continue;
        
        if (contact?.unsubscribed) {
          console.log(`⏳ Skipping email to ${contact.email} - unsubscribed.`);
          continue;
        }

        const lastSent = await prisma.emailTriggerLog.findFirst({
          where: { email: contact.email, campaignId: campaign.id },
          orderBy: { createdAt: "desc" },
        });

        const sortedSequences = campaign.sequences.sort((a, b) => (a.seq_number || 0) - (b.seq_number || 0));

        let nextSequence: Sequence;
        if (!lastSent) {
          nextSequence = sortedSequences[0];
        } else {
          const lastIndex = sortedSequences.findIndex((seq) => seq.id === lastSent.sequenceId);
          nextSequence = sortedSequences[lastIndex + 1];

          const lastSentTime = DateTime.fromJSDate(lastSent.createdAt).toUTC();
          const nowUTC = DateTime.utc();

          // if (lastSentTime.plus({ days: 1 }) > nowUTC && nextSequence) {
            if (lastSentTime.plus({ hours: 1 }) > nowUTC && nextSequence) {
            console.log(`⏳ Skipping email to ${contact.email} - waiting period not over.`);
            continue;
          }
        }

        if (!nextSequence) {
          console.log(`✅ No further sequences for ${contact.email} in campaign ${campaign.campaignName}`);
          continue;
        }

        const variables = {
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone_number: contact.phone_number,
          company_name: contact.company_name,
          company_location: contact.company_location,
          industry_type: contact.industry_type,
          website: contact.website,
          linkedin_profile: contact.linkedin_profile,
          location: contact.location,
          designation: contact.designation,
          "day of week": new Date().toLocaleString("en-US", { weekday: "long" }),
          "time of day": new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) // e.g., "10:30 AM"
        };

        const subject = replaceTemplateVariables(
          nextSequence.seq_variants[0].subject || `Your Campaign: {{campaign_name}}`,
          variables
        );
        const setting = campaign.email_campaign_settings?.[0]
          ?.campaign_settings as unknown as Record<string, any>;
        const unsubscribe = setting?.Unsubscribe ?? true;
        const stopSending = setting?.stopSending ?? "";
        
        const emailTriggerLog = await prisma.emailTriggerLog.findFirst({
          where: { email: contact.email, campaignId: campaign.id },
        });
        
        if (emailTriggerLog) {
          if (stopSending === "clicks" && emailTriggerLog.email_clicked) {
            console.log(`⏳ Skipping email to ${contact.email} - email has been clicked.`);
            continue;
          } else if (stopSending === "opens" && emailTriggerLog.email_opened) {
            console.log(`⏳ Skipping email to ${contact.email} - email has been opened.`);
            continue;
          } else if (stopSending === "replies" && emailTriggerLog.replied_mail) {
            console.log(`⏳ Skipping email to ${contact.email} - email has been replied to.`);
            continue;
          }
        }
      
        const isPlainText = setting?.emailDeliveryOptimization ?? true;

        const tarcking = setting?.trackLinkClicks ?? "";
        const tarckingOpenEmail = setting?.trackEmailOpens?? "";
        
        const unsubscribeLink = unsubscribe
        ? `<br/><br/> <a href="${ process.env.FRONTEND_URL}/unsubscribe/${contact.email}">Unsubscribe</a>`
        : "";

        const body = replaceTemplateVariables(
          nextSequence.seq_variants[0].emailBody || `<p>Hi {{first_name}},</p><p>test email</p>`,
          variables
        ) + unsubscribeLink;

        const senderAccount = campaign.email_campaign_settings?.[0]?.sender_accounts?.[0] as unknown as EmailAccount;

        // Debug logging for account data
        if (senderAccount && senderAccount.type === 'gmail') {
          console.log("📧 Sending email with account:", {
            email: senderAccount.email,
            accountId: senderAccount.account_id,
            type: senderAccount.type,
            hasRefreshToken: !!senderAccount.oauth2?.tokens?.refresh_token,
            hasClientId: !!senderAccount.oauth2?.clientId,
            hasClientSecret: !!senderAccount.oauth2?.clientSecret,
            refreshTokenPreview: senderAccount.oauth2?.tokens?.refresh_token?.substring(0, 20) + "..."
          });
        }

        if (campaign.status !== "PAUSED") {
          try {
            await sendEmail(
              campaign.id,
              campaign.orgId,
              senderAccount,
              contact.email,
              subject,
              body,
              isPlainText,
              tarcking,
              tarckingOpenEmail
            );
          } catch (emailError: any) {
            // Check if this is a re-authentication required error
            if (emailError?.message?.includes("REAUTH_REQUIRED")) {
              console.error(`🚨 REAUTH REQUIRED for account: ${senderAccount?.email || 'unknown'}`);
              console.error(`🚨 Campaign ID: ${campaign.id}, Account ID: ${senderAccount?.account_id || 'unknown'}`);
              console.error(`🚨 This account needs to be re-authenticated. Skipping email to ${contact.email}`);
              // Skip this email but continue with others
              continue;
            }
            // For other errors, log and continue
            console.error(`❌ Error sending email to ${contact.email}:`, emailError.message);
            continue;
          }
        }

        await prisma.emailTriggerLog.create({
          data: {
            email: contact.email,
            campaignId: campaign.id,
            sequenceId: nextSequence.id,
          },
        });

        console.log(`📧 Sent sequence ${nextSequence.seq_number} to ${contact.email}`);
      }

      const campaignContacts = await prisma.emailCampaign.findMany({
        where: { campaignId: campaign.id },
        include: { contact: true },
      });
      
      const campaignTriggerLogs = await prisma.emailTriggerLog.findMany({
        where: { campaignId: campaign.id },
      });
      
      // Extract unique emails from campaign contacts
      const campaignContactEmails = campaignContacts.map((contact) => contact.contact.email);
      
      // Group trigger logs by email
      const emailTriggerMap = new Map<string, Set<string>>();
      campaignTriggerLogs.forEach((log) => {
        if (!emailTriggerMap.has(log.email)) {
          emailTriggerMap.set(log.email, new Set());
        }
        emailTriggerMap.get(log.email)!.add(log.sequenceId);
      });
      
      // Check if all campaign contacts have completed all sequences
      const allCompleted = campaignContacts.every((contact) => {
        const email = contact.contact.email ?? '';
        const requiredSequences = campaign.sequences
        const triggeredSequences = emailTriggerMap.get(email) || new Set();
      
        return requiredSequences.every((seq) => triggeredSequences.has(seq.id));
      });
      
      if (allCompleted) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: "COMPLETED" },
        });
        console.log(`✅ Campaign ${campaign.id} marked as COMPLETED.`);
      } else {
        console.log(`⏳ Campaign ${campaign.id} still has pending sequences.`);
      }
    }
  } catch (error) {
    console.error("❌ Error in email cron job:", error);
  }
});
