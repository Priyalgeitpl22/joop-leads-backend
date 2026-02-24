import { AddOnCode, PlanCode, PrismaClient } from "@prisma/client";
import { subscriptionActivationEmail } from "../utils/email.utils";
import * as OrganizationAddOnService from "./organization.addon.service";

const prisma = new PrismaClient();
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

    const orgAddOnsResult = await OrganizationAddOnService.getOrgAddOns(orgId);
    const addOns = orgAddOnsResult.code === 200 ? (orgAddOnsResult.data ?? []) : [];

    return {
      code: 200,
      message: "Current plan fetched successfully",
      data: {
        planCode: currentPlan.plan.code,
        ...currentPlan.plan,
        ...currentPlan,
        addOns,
      },
    };
  }

  static async contactSales(
    user: { orgId: string; email: string; role: string },
    planCode: string,
    addOns: { name: string; code: string }[],
    billingPeriod: string,
    totalCost: number
  ) {
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return { code: 401, message: "Only admin can change the subscription plan" };
    }

    if (!planCode || !billingPeriod || !addOns || totalCost == null) {
      return { code: 400, message: "All fields (planCode, billingPeriod, addOns, totalCost) are required" };
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode as PlanCode } });
    const addOnCodes = addOns.map((a) => a.code as AddOnCode);
    const addOnsData = await prisma.addOn.findMany({ where: { code: { in: addOnCodes } } });
    if (addOnsData.length !== addOns.length) {
      return { code: 400, message: "Invalid add-ons: one or more add-on codes not found" };
    }

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

    // Deactivate all existing org add-ons (pending subscription change)
    const existingAddOns = await prisma.organizationAddOn.findMany({ where: { orgId: user.orgId } });
    for (const orgAddOn of existingAddOns) {
      await prisma.organizationAddOn.update({
        where: { orgId_addOnId: { orgId: user.orgId, addOnId: orgAddOn.addOnId } },
        data: { isActive: false },
      });
    }

    // Upsert requested add-ons as inactive (to be activated after payment)
    for (const addOn of addOnsData) {
      await prisma.organizationAddOn.upsert({
        where: { orgId_addOnId: { orgId: user.orgId, addOnId: addOn.id } },
        create: { orgId: user.orgId, addOnId: addOn.id, isActive: false },
        update: { isActive: false },
      });
    }

    return { code: 200, message: "Email sent successfully" };
  }

  static async assignFreePlanToAllOrgs() {
    const organizations = await prisma.organization.findMany();
    for (const organization of organizations) {
      await this.assignPlan(organization.id, PlanCode.FREE, "MONTHLY");
    }
    return { code: 200, message: "Free plan assigned to all organizations" };
  }

  static async activatePlan(orgId: string, planCode: string, billingPeriod: string) {

    if (!orgId || !planCode || !billingPeriod) {
      return { code: 400, message: "All fields (orgId, planCode, billingPeriod) are required" };
    }

    if (billingPeriod !== "MONTHLY" && billingPeriod !== "YEARLY") {
      return { code: 400, message: "Invalid billing period" };
    }

    if (planCode !== PlanCode.FREE && planCode !== PlanCode.STARTER && planCode !== PlanCode.ENTERPRISE) {
      return { code: 400, message: "Invalid plan code" };
    }

    const organization = await prisma.organization.findUnique({ where: { id: orgId }, include: { plans: true } });
    if (!organization) return { code: 400, message: "Organization not found" };

    if (organization.plans.length === 0) {
      return { code: 400, message: "No plan requested for this organization. Please contact support." };
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode as PlanCode } });
    if (!plan) return { code: 400, message: "Plan not found" };

    if (organization.plans.some((orgPlan) => orgPlan.planId === plan.id && orgPlan.isActive)) {
      return { code: 400, message: "Plan already assigned to this organization" };
    }

    if (organization.plans.some((orgPlan) => orgPlan.planId !== plan.id && !orgPlan.isActive)) {
      return { code: 400, message: "No such plan request found. Please contact support." };
    }

    await prisma.organizationPlan.update({
      where: {
        orgId_isActive: { orgId, isActive: false }
      },
      data: {
        planId: plan.id,
        isActive: true, billingPeriod: billingPeriod as "MONTHLY" | "YEARLY",
        startsAt: new Date(),
        endsAt: billingPeriod === "MONTHLY" ? new Date(new Date().setMonth(new Date().getMonth() + 1)) : new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      }
    });

    const existingAddOns = await prisma.organizationAddOn.findMany({ where: { orgId } });
    for (const orgAddOn of existingAddOns) {
      await prisma.organizationAddOn.update({
        where: { orgId_addOnId: { orgId, addOnId: orgAddOn.addOnId } },
        data: { isActive: true, periodStartsAt: new Date(), periodEndsAt: billingPeriod === "MONTHLY" ? new Date(new Date().setMonth(new Date().getMonth() + 1)) : new Date(new Date().setFullYear(new Date().getFullYear() + 1)) },
      });
    }

    return { code: 200, message: "Plan activated successfully" };
  }
}

