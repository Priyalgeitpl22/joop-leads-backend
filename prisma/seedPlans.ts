// prisma/seedPlans.ts
import { PrismaClient, PlanCode, AddOnCode } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Seed plans
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
      hasEmailWarmup: true,
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
      hasEmailWarmup: true,
    },
    {
      code: PlanCode.ENTERPRISE,
      name: 'Enterprise',
      description: 'Unlimited scale. Contact sales for custom limits and support.',
      priceMonthly: 200,
      priceYearly: null,
      isContactSales: true,
      maxUsers: null,
      maxSenderAccounts: null,
      maxLeadsPerMonth: null,
      maxEmailsPerMonth: null,
      maxCampaigns: null,
      hasEmailVerification: true,
      hasEmailWarmup: true,
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

  // 2. Seed add-ons (available to attach to any plan)
  const addOns = [
    {
      code: AddOnCode.EMAIL_VERIFICATION,
      name: 'Email Verification',
      description: 'Verify your email addresses to ensure they are valid and not spam.',
      priceMonthly: 10,
      priceYearly: 100,
      emailVerificationLimit: 1000,
    },
  ]

  for (const data of addOns) {
    await prisma.addOn.upsert({
      where: { code: data.code },
      update: data,
      create: data,
    })
  }
  console.log('Seeded add-ons successfully')

  // 3. Link add-ons to existing plans (which plans can use which add-ons)
  const allPlans = await prisma.plan.findMany({ select: { id: true, code: true } })
  const emailVerificationAddOn = await prisma.addOn.findUnique({
    where: { code: AddOnCode.EMAIL_VERIFICATION },
    select: { id: true },
  })

  if (emailVerificationAddOn) {
    for (const plan of allPlans) {
      await prisma.planAddOn.upsert({
        where: {
          planId_addOnId: { planId: plan.id, addOnId: emailVerificationAddOn.id },
        },
        update: {},
        create: { planId: plan.id, addOnId: emailVerificationAddOn.id },
      })
    }
    console.log('Linked add-ons to plans successfully')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
