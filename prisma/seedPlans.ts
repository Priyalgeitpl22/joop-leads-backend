// prisma/seedPlans.ts
import { PrismaClient, PlanCode } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plans = [
    {
      code: PlanCode.FREE,
      name: 'Free',
      description: 'Perfect for getting started with email outreach and warmup.',
      priceMonthly: null,
      priceYearly: null,
      isContactSales: false,
      maxUsers: null,
      maxSenderAccounts: 30,
      maxLeadsPerMonth: 1000,
      maxEmailsPerMonth: 2000,
      maxCampaigns: null,
      hasEmailVerification: false,
      hasEmailWarmup: true
    },
    {
      code: PlanCode.STARTER,
      name: 'Starter',
      description: 'For growing teams with higher sending and contact limits.',
      priceMonthly: 30,
      priceYearly: null,
      isContactSales: false,
      maxUsers: null,
      maxSenderAccounts: 100,
      maxLeadsPerMonth: 10000,
      maxEmailsPerMonth: 5000,
      maxCampaigns: null,
      hasEmailVerification: false,
      hasEmailWarmup: true
    },
    {
      code: PlanCode.ENTERPRISE,
      name: 'Enterprise',
      description: 'Unlimited scale. Contact sales for custom limits and support.',
      priceMonthly: 2000,
      priceYearly: null,
      isContactSales: true,
      maxUsers: null,
      maxSenderAccounts: null,
      maxLeadsPerMonth: null,
      maxEmailsPerMonth: null,
      maxCampaigns: null,
      hasEmailVerification: true,
      hasEmailWarmup: true
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
