// prisma/seedPlans.ts
import { PrismaClient, PlanCode, SupportType } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const plans = [
    {
      code: PlanCode.FREE,
      name: 'Free',
      description: 'Perfect for getting started with email outreach and warmup.',
      priceUsd: null,
      isContactSales: false,
      maxSenderAccounts: 5,
      maxLeadListPerMonth: 2000,
      maxEmailsPerMonth: 400,
      maxLiveCampaigns: 1,
      includeEmailVerification: false,
      includeEmailWarmup: true,
      includeUnifiedInbox: true,
      includeTeammates: false,
      includeAiCampaignGen: false,
      includeAiTagging: false,
      includeAiResponses: false,
      includeAiImprovement: false,
      includeWebsiteLinkWarmup: false,
      offer: 20,
      supportType: SupportType.COMMUNITY,
    },
    {
      code: PlanCode.SILVER,
      name: 'Silver',
      description: 'Ideal for growing teams with higher sending limits.',
      priceUsd: 30,
      isContactSales: false,
      maxSenderAccounts: 50,
      maxLeadListPerMonth: 10000,
      maxEmailsPerMonth: 20000,
      maxLiveCampaigns: 5,
      includeEmailVerification: false,
      includeEmailWarmup: true,
      includeUnifiedInbox: true,
      includeTeammates: false,
      includeAiCampaignGen: false,
      includeAiTagging: false,
      includeAiResponses: false,
      includeAiImprovement: false,
      includeWebsiteLinkWarmup: false,
      offer: 20,
      supportType: SupportType.EMAIL_24x7,
    },
    {
      code: PlanCode.GOLD,
      name: 'Gold',
      description: 'Best for agencies and high-volume senders with AI features.',
      priceUsd: 80,
      isContactSales: false,
      maxSenderAccounts: 100,
      maxLeadListPerMonth: 25000,
      maxEmailsPerMonth: 50000,
      maxLiveCampaigns: 20,
      includeEmailVerification: false,
      includeEmailWarmup: true,
      includeUnifiedInbox: true,
      includeTeammates: true,
      includeAiCampaignGen: true,
      includeAiTagging: true,
      includeAiResponses: false,
      includeAiImprovement: false,
      includeWebsiteLinkWarmup: false,
      offer: 20,
      supportType: SupportType.PRIORITY_EMAIL_CHAT,
    },
    {
      code: PlanCode.PLATINUM,
      name: 'Platinum',
      description: 'Unlimited scale with full AI automation and premium support.',
      priceUsd: 100,
      isContactSales: true,
      maxSenderAccounts: 200,
      maxLeadListPerMonth: 50000,
      maxEmailsPerMonth: 100000,
      maxLiveCampaigns: 50,
      includeEmailVerification: true,
      includeEmailWarmup: true,
      includeUnifiedInbox: true,
      includeTeammates: true,
      includeAiCampaignGen: true,
      includeAiTagging: true,
      includeAiResponses: true,
      includeAiImprovement: true,
      includeWebsiteLinkWarmup: true,
      offer: 20,
      supportType: SupportType.PHONE_WHATSAPP,
    },
  ]

  for (const data of plans) {
    await prisma.plan.upsert({
      where: { code: data.code },
      update: data,
      create: data,
    })
  }

  console.log('Seeded plans successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
