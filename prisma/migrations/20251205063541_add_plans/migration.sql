-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "SupportType" AS ENUM ('COMMUNITY', 'EMAIL_24x7', 'PRIORITY_EMAIL_CHAT', 'PHONE_WHATSAPP');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceUsd" DECIMAL(65,30),
    "isContactSales" BOOLEAN NOT NULL DEFAULT false,
    "maxSenderAccounts" INTEGER,
    "maxLeadListPerMonth" INTEGER,
    "maxEmailsPerMonth" INTEGER,
    "maxLiveCampaigns" INTEGER,
    "includeEmailVerification" BOOLEAN NOT NULL DEFAULT false,
    "includeEmailWarmup" BOOLEAN NOT NULL DEFAULT true,
    "includeUnifiedInbox" BOOLEAN NOT NULL DEFAULT true,
    "includeTeammates" BOOLEAN NOT NULL DEFAULT false,
    "includeAiCampaignGen" BOOLEAN NOT NULL DEFAULT false,
    "includeAiTagging" BOOLEAN NOT NULL DEFAULT false,
    "includeAiResponses" BOOLEAN NOT NULL DEFAULT false,
    "includeAiImprovement" BOOLEAN NOT NULL DEFAULT false,
    "includeWebsiteLinkWarmup" BOOLEAN NOT NULL DEFAULT false,
    "supportType" "SupportType" NOT NULL DEFAULT 'COMMUNITY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPlan" (
    "id" SERIAL NOT NULL,
    "orgId" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "emailsSentThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "leadsAddedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "senderAccountsInUse" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- AddForeignKey
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
