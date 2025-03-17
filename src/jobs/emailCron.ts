import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { EmailAccount, Sequence } from "../interfaces";
import { DateTime } from "luxon"; // Use Luxon for better timezone handling
import { sendEmail } from "./sendMail";

// Get current time in UTC
const nowUTC = DateTime.utc();
const prisma = new PrismaClient();

cron.schedule("*/1 * * * *", async () => {
  console.log("🔄 Running campaign email cron job...");

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { status: "SCHEDULED" },
      include: {
        sequences: true,
        email_campaign_settings: true,
        emailCampaigns: { include: { contact: true } },
      },
    });

    console.log("campaigns", campaigns)

    const eligibleCampaigns = campaigns.filter((campaign) => {
      const schedule = campaign.email_campaign_settings?.[0]?.campaign_schedule as any;

      if (!schedule) {
        console.log(`⚠️ Campaign ${campaign.id} has no schedule.`);
        return false;
      }

      try {
        const {
          startDate,
          startTime,
          endTime,
          selectedDays,
        } = schedule;

        const campaignStart = new Date(startDate);
        const campaignEnd = new Date(endTime);
        const campaignStartTime = new Date(startTime);

        const nowUTC = new Date();

        const isStarted = nowUTC >= campaignStartTime;
        const currentDay = nowUTC.getUTCDay() === 0 ? 7 : nowUTC.getUTCDay();
        let isCorrectDay;

        if (selectedDays.length > 0) {
          isCorrectDay = selectedDays.includes(currentDay);
        } else if (selectedDays.length === 0){
          isCorrectDay = true;
        }

        console.log("nowUTC -->>", nowUTC);
        console.log("campaignEnd -->>", campaignEnd);
        console.log("isStarted -->>", isStarted);
        console.log("isCorrectDay -->>", isCorrectDay);

        return isStarted && isCorrectDay;
      } catch (error) {
        console.error(`❌ Error checking campaign ${campaign.id}:`, error);
        return false;
      }
    });

    console.log(`✅ Found ${eligibleCampaigns.length} eligible campaigns.`);
    console.log("eligibleCampaigns", eligibleCampaigns);

    for (const campaign of eligibleCampaigns) {
      for (const emailCampaign of campaign.emailCampaigns) {
        const contact = emailCampaign.contact;
        if (!contact || !contact.email) continue;

        const lastSent = await prisma.emailTriggerLog.findFirst({
          where: {
            email: contact.email,
            campaignId: campaign.id,
          },
          orderBy: { createdAt: "desc" },
        });

        const sortedSequences = campaign.sequences.sort((a, b) => (a.seq_number || 0) - (b.seq_number || 0));

        let nextSequence: Sequence;
        if (!lastSent) {
          nextSequence = sortedSequences[0];
        } else {
          const lastIndex = sortedSequences.findIndex(
            (seq) => seq.id === lastSent.sequenceId
          );
          nextSequence = sortedSequences[lastIndex + 1];

          const lastSentTime = DateTime.fromJSDate(lastSent.createdAt).toUTC();
          const nowUTC = DateTime.utc();

          if (lastSentTime.plus({ days: 1 }) > nowUTC) {
            console.log(
              `⏳ Skipping email to ${contact.email} - waiting period not over.`
            );
          }
          continue;
        }

        if (!nextSequence) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              status: 'COMPLETED',
            },
          });

          console.log(`✅ No further sequences for ${contact.email} in campaign ${campaign.campaignName}`);
          continue;
        }

        const subject = nextSequence.seq_variants[0].subject || `Your Campaign: ${campaign.campaignName}`;
        const body = nextSequence.seq_variants[0].emailBody || `<p>Hi ${contact.first_name},</p><p>test email</p>`;

        const senderAccount = campaign.email_campaign_settings?.[0]?.sender_accounts?.[0] as unknown as EmailAccount;

        await sendEmail(campaign.id, campaign.orgId, senderAccount, contact.email, subject, body);

        await prisma.emailTriggerLog.create({
          data: {
            email: contact.email,
            campaignId: campaign.id,
            sequenceId: nextSequence.id,
          },
        });

        console.log(`📧 Sent sequence ${nextSequence.seq_number} to ${contact.email}`);
      }
    }
  } catch (error) {
    console.error("❌ Error in email cron job:", error);
  }
});
