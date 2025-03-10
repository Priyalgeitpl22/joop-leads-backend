import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { Sequence } from "../interfaces";
import { DateTime } from "luxon"; // Use Luxon for better timezone handling

// Get current time in UTC
const nowUTC = DateTime.utc();
const prisma = new PrismaClient();

const sendEmail = async (orgId: string, senderAccount: any, email: string, subject: string, body: string) => {
  try {
    const org = await prisma.organization.findUnique({
      where: {
        id: orgId
      }
    })

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: senderAccount.user,
        pass: senderAccount.pass,
      },
    });

    await transporter.sendMail({
      from: `${org?.name}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: body,
    });
    console.log(`✅ Email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error);
  }
};

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
        const isNotEnded = nowUTC < campaignEnd;
        const isCorrectDay = selectedDays.includes(nowUTC.getUTCDay());

        return isStarted && isNotEnded && isCorrectDay;
      } catch (error) {
        console.error(`❌ Error checking campaign ${campaign.id}:`, error);
        return false;
      }
    });

    console.log(`✅ Found ${eligibleCampaigns.length} eligible campaigns.`);

    console.log(eligibleCampaigns);

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
          const lastIndex = sortedSequences.findIndex(seq => seq.id === lastSent.sequenceId);
          nextSequence = sortedSequences[lastIndex + 1];
        }

        if (!nextSequence) {
          console.log(`✅ No further sequences for ${contact.email} in campaign ${campaign.id}`);
          continue;
        }

        const subject = nextSequence.seq_variants[0].subject || `Your Campaign: ${campaign.campaignName}`;
        const body = nextSequence.seq_variants[0].emailBody || `<p>Hi ${contact.first_name},</p><p>test email</p>`;

        const senderAccount = campaign.email_campaign_settings[0].sender_accounts[0];

        await sendEmail(campaign.orgId, senderAccount, contact.email, subject, body);

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
