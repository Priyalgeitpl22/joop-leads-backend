import { PlanCode, PrismaClient, Plan } from "@prisma/client";

const prisma = new PrismaClient();

const formatPlanResponse = (plan: Plan) => ({
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

    return { code: 200, message: "Plans fetched successfully", data: plans.map(formatPlanResponse) };
  }

  static async getByCode(code: string) {
    const plan = await prisma.plan.findUnique({ where: { code: code as PlanCode } });

    if (!plan) {
      return { code: 404, message: "Plan not found" };
    }

    return { code: 200, message: "Plan fetched successfully", data: formatPlanResponse(plan) };
  }
}

