import { PlanCode, PrismaClient, Plan, OrganizationPlan } from "@prisma/client";

const prisma = new PrismaClient();

const formatPlanResponse = (plan: Plan, orgPlan?: OrganizationPlan) => ({
  id: plan.id,
  name: plan.name,
  code: plan.code,
  description: plan.description,
  priceMonthly: plan.priceMonthly,
  priceYearly: plan.priceYearly,
  isContactSales: plan.isContactSales,
  maxUsers: plan.maxUsers,
  maxSenderAccounts: plan.maxSenderAccounts,
  maxLeadsPerMonth: plan.maxLeadsPerMonth,
  maxEmailsPerMonth: plan.maxEmailsPerMonth,
  leadsAddedThisPeriod: orgPlan?.leadsAddedThisPeriod || 0,
  emailsSentThisPeriod: orgPlan?.emailsSentThisPeriod || 0,
  senderAccountsCount: orgPlan?.senderAccountsCount || 0,
  maxCampaigns: plan.maxCampaigns,
  hasEmailVerification: plan.hasEmailVerification,
  hasEmailWarmup: plan.hasEmailWarmup,
  hasUnifiedInbox: plan.hasUnifiedInbox,
  hasApiAccess: plan.hasApiAccess,
  hasCustomDomain: plan.hasCustomDomain,
  hasAdvancedAnalytics: plan.hasAdvancedAnalytics,
  hasPrioritySupport: plan.hasPrioritySupport,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

export class PlanService {
  static async getAll() {
    const plans = await prisma.plan.findMany();

    if (!plans || plans.length === 0) {
      return { code: 404, message: "No plans found" };
    }

    return { code: 200, message: "Plans fetched successfully", data: plans.map((plan) => formatPlanResponse(plan)) };
  }

  static async getByCode(code: string) {
    const plan = await prisma.plan.findUnique({ where: { code: code as PlanCode } });

    if (!plan) {
      return { code: 404, message: "Plan not found" };
    }

    return { code: 200, message: "Plan fetched successfully", data: formatPlanResponse(plan, undefined) };
  }

  static async getPlanByOrgId(orgId: string) {
    try {
      const subscription = await prisma.organizationPlan.findFirst({ where: { orgId, isActive: true }, include: { plan: true } });
      if (!subscription || !subscription.plan) {
        return null;
      }
      return formatPlanResponse(subscription.plan, subscription);
    } catch (err: any) {
      console.error(err);
      return null;
    }
  }
}
