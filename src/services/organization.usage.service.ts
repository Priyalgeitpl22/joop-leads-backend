import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Increment the organization's "emails sent this period" usage by 1.
 * Call this when an email is successfully sent (e.g. in the email worker after status → SENT).
 */
export async function incrementEmailsSent(orgId: string): Promise<void> {
  const sub = await prisma.organizationPlan.findFirst({
    where: { orgId, isActive: true },
  });
  if (!sub) return;

  await prisma.organizationPlan.update({
    where: { id: sub.id },
    data: { emailsSentThisPeriod: { increment: 1 } },
  });
}

/**
 * Increment the organization's "leads added this period" usage by count.
 * Call this when leads are added (CSV upload, single lead create, etc.).
 */
export async function incrementLeadsAdded(orgId: string, count: number): Promise<void> {
  if (count <= 0) return;

  const sub = await prisma.organizationPlan.findFirst({
    where: { orgId, isActive: true },
  });
  if (!sub) return;

  await prisma.organizationPlan.update({
    where: { id: sub.id },
    data: { leadsAddedThisPeriod: { increment: count } },
  });
}

/**
 * Return current usage and plan limits for an org (for checks before adding leads, etc.).
 */
export async function getUsageAndLimits(orgId: string) {
  const subscription = await prisma.organizationPlan.findFirst({
    where: { orgId, isActive: true },
    include: { plan: true },
  });

  if (!subscription?.plan) return null;

  const plan = subscription.plan;
  const senderCount = await prisma.senderAccount.count({ where: { orgId } });

  return {
    subscription,
    plan,
    emailsSentThisPeriod: subscription.emailsSentThisPeriod,
    leadsAddedThisPeriod: subscription.leadsAddedThisPeriod,
    senderAccountsCount: senderCount,
    limits: {
      maxEmailsPerMonth: plan.maxEmailsPerMonth,
      maxLeadsPerMonth: plan.maxLeadsPerMonth,
      maxSenderAccounts: plan.maxSenderAccounts,
      maxCampaigns: plan.maxCampaigns,
    },
  };
}
