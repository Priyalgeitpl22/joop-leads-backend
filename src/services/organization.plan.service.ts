import { PlanCode, PrismaClient } from "@prisma/client";
import { subscriptionActivationEmail } from "../utils/email.utils";

const prisma = new PrismaClient();

export const assignFreePlanToOrg = async (orgId: string): Promise<void> => {
  const freePlan = await prisma.plan.findUnique({ where: { code: PlanCode.FREE } });

  if (!freePlan) {
    console.error("FREE plan not found in database");
    return;
  }

  const existingPlan = await prisma.organizationPlan.findFirst({ where: { orgId } });
  if (existingPlan) return;

  await prisma.organizationPlan.create({
    data: {
      orgId,
      planId: freePlan.id,
      billingPeriod: "MONTHLY",
      isActive: true,
      startsAt: new Date(),
      endsAt: null,
      emailsSentThisPeriod: 0,
      leadsAddedThisPeriod: 0,
      senderAccountsCount: 0,
    },
  });
};

export class OrganizationPlanService {
  static async assignPlan(orgId: string, planCode: string, billingPeriod: string) {
    if (!orgId || !planCode || !billingPeriod) {
      return { code: 400, message: "All fields (orgId, planCode, billingPeriod) are required" };
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode as PlanCode } });
    if (!plan) return { code: 400, message: "Plan not found" };

    const now = new Date();
    const endsAt =
      billingPeriod === "YEARLY"
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : billingPeriod === "MONTHLY"
        ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
        : null;

    const existingPlan = await prisma.organizationPlan.findFirst({ where: { orgId } });

    let organizationPlan;
    if (existingPlan) {
      organizationPlan = await prisma.organizationPlan.update({
        where: { id: existingPlan.id },
        data: {
          planId: plan.id,
          billingPeriod: billingPeriod as "MONTHLY" | "YEARLY",
          isActive: true,
          startsAt: now,
          endsAt,
          emailsSentThisPeriod: 0,
          leadsAddedThisPeriod: 0,
          senderAccountsCount: 0,
        },
      });
    } else {
      organizationPlan = await prisma.organizationPlan.create({
        data: {
          orgId,
          planId: plan.id,
          billingPeriod: billingPeriod as "MONTHLY" | "YEARLY",
          isActive: true,
          startsAt: now,
          endsAt,
          emailsSentThisPeriod: 0,
          leadsAddedThisPeriod: 0,
          senderAccountsCount: 0,
        },
      });
    }

    return { code: 200, message: "Plan assigned successfully", data: organizationPlan };
  }

  static async getCurrentPlan(orgId: string) {
    const currentPlan = await prisma.organizationPlan.findFirst({
      where: { orgId },
      include: { plan: true },
    });

    if (!currentPlan) {
      return { code: 400, message: "No plan assigned to this organization" };
    }

    return {
      code: 200,
      message: "Current plan fetched successfully",
      data: { planCode: currentPlan.plan.code, ...currentPlan.plan, ...currentPlan },
    };
  }

  static async contactSales(user: { orgId: string; email: string; role: string }, planCode: string, addOns: string[], billingPeriod: string, totalCost: number) {
    if (user.role !== "ADMIN") {
      return { code: 401, message: "Only admin can change the subscription plan" };
    }

    if (!planCode || !billingPeriod || !addOns || !totalCost) {
      return { code: 400, message: "All fields (planCode, billingPeriod) are required" };
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode as PlanCode } });
    const organization = await prisma.organization.findUnique({ where: { id: user.orgId } });

    if (!organization) return { code: 400, message: "Organization not found" };
    if (!plan) return { code: 400, message: "Plan not found" };

    await subscriptionActivationEmail(planCode, billingPeriod, addOns, organization.name || "", user.email || "", totalCost);

    const existingPlan = await prisma.organizationPlan.findFirst({ where: { orgId: user.orgId } });

    if (existingPlan) {
      await prisma.organizationPlan.update({
        where: { id: existingPlan.id },
        data: { planId: plan.id, billingPeriod: billingPeriod as "MONTHLY" | "YEARLY", isActive: false },
      });
    } else {
      await prisma.organizationPlan.create({
        data: { orgId: user.orgId, planId: plan.id, billingPeriod: billingPeriod as "MONTHLY" | "YEARLY", isActive: false },
      });
    }

    return { code: 200, message: "Email sent successfully" };
  }
}

