/*
  Warnings:

  - The values [CUSTOM] on the enum `BillingPeriod` will be removed. If these variants are still used in the database, this will fail.
  - The values [BLOCKED] on the enum `CampaignStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SILVER,GOLD,PLATINUM] on the enum `PlanCode` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `campaign_name` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `contacts` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `counts` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `csvFile` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `csvSettings` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `email_campaign_settings_id` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `schedule` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `sequencesIds` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `bounced_count` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `clicked_count` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `opened_count` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `orgId` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `positive_reply_count` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `replied_count` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `sent_count` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - The primary key for the `CampaignRuntime` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `error` on the `EmailSend` table. All the data in the column will be lost.
  - The `status` column on the `EmailSend` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `campaignId` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `senderAccountsInUse` on the `OrganizationPlan` table. All the data in the column will be lost.
  - You are about to drop the column `includeAiCampaignGen` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeAiImprovement` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeAiResponses` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeAiTagging` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeEmailVerification` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeEmailWarmup` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeTeammates` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeUnifiedInbox` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `includeWebsiteLinkWarmup` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `maxLeadListPerMonth` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `maxLiveCampaigns` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `offer` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `priceUsd` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `supportType` on the `Plan` table. All the data in the column will be lost.
  - The primary key for the `SenderRuntime` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `activationTokenExpires` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `online` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenExpires` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `schedule` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `User` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `CampaignFolder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampaignFolderMapping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampaignTriggerLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Contact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailCampaignSettings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailTriggerLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Sequences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrackEmails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `access_token` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[campaignId]` on the table `CampaignRuntime` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campaignId,leadId,sequenceStep]` on the table `EmailSend` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orgId,email]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[domain]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orgId,isActive]` on the table `OrganizationPlan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orgId,email]` on the table `SenderAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[senderId,dayKey]` on the table `SenderRuntime` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Made the column `status` on table `Campaign` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `CampaignAnalytics` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `CampaignRuntime` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `CampaignRuntime` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EmailSend` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgId` to the `Lead` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Lead` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `Organization` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `orgId` to the `SenderAccount` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `SenderRuntime` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `SenderRuntime` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "SequenceType" AS ENUM ('EMAIL', 'WAIT', 'MANUAL_TASK');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('SMTP', 'GMAIL_API', 'OUTLOOK_API', 'SENDGRID', 'AWS_SES');

-- CreateEnum
CREATE TYPE "WarmupStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'COMPLAINED');

-- AlterEnum
BEGIN;
CREATE TYPE "BillingPeriod_new" AS ENUM ('MONTHLY', 'YEARLY');
ALTER TABLE "OrganizationPlan" ALTER COLUMN "billingPeriod" DROP DEFAULT;
ALTER TABLE "OrganizationPlan" ALTER COLUMN "billingPeriod" TYPE "BillingPeriod_new" USING ("billingPeriod"::text::"BillingPeriod_new");
ALTER TYPE "BillingPeriod" RENAME TO "BillingPeriod_old";
ALTER TYPE "BillingPeriod_new" RENAME TO "BillingPeriod";
DROP TYPE "BillingPeriod_old";
ALTER TABLE "OrganizationPlan" ALTER COLUMN "billingPeriod" SET DEFAULT 'MONTHLY';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CampaignStatus_new" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
ALTER TABLE "Campaign" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "status" TYPE "CampaignStatus_new" USING ("status"::text::"CampaignStatus_new");
ALTER TYPE "CampaignStatus" RENAME TO "CampaignStatus_old";
ALTER TYPE "CampaignStatus_new" RENAME TO "CampaignStatus";
DROP TYPE "CampaignStatus_old";
ALTER TABLE "Campaign" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PlanCode_new" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
ALTER TABLE "Plan" ALTER COLUMN "code" TYPE "PlanCode_new" USING ("code"::text::"PlanCode_new");
ALTER TYPE "PlanCode" RENAME TO "PlanCode_old";
ALTER TYPE "PlanCode_new" RENAME TO "PlanCode";
DROP TYPE "PlanCode_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "CampaignAnalytics" DROP CONSTRAINT "CampaignAnalytics_orgId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignFolder" DROP CONSTRAINT "CampaignFolder_orgId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignFolderMapping" DROP CONSTRAINT "CampaignFolderMapping_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignFolderMapping" DROP CONSTRAINT "CampaignFolderMapping_folderId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignTriggerLog" DROP CONSTRAINT "CampaignTriggerLog_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignTriggerLog" DROP CONSTRAINT "CampaignTriggerLog_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_uploadedBy_fkey";

-- DropForeignKey
ALTER TABLE "EmailCampaign" DROP CONSTRAINT "EmailCampaign_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "EmailCampaign" DROP CONSTRAINT "EmailCampaign_contactId_fkey";

-- DropForeignKey
ALTER TABLE "EmailCampaignSettings" DROP CONSTRAINT "EmailCampaignSettings_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "EmailTriggerLog" DROP CONSTRAINT "EmailTriggerLog_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "EmailTriggerLog" DROP CONSTRAINT "EmailTriggerLog_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationPlan" DROP CONSTRAINT "OrganizationPlan_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Sequences" DROP CONSTRAINT "Sequences_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "TrackEmails" DROP CONSTRAINT "TrackEmails_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_orgId_fkey";

-- DropIndex
DROP INDEX "EmailSend_campaignId_leadId_key";

-- DropIndex
DROP INDEX "EmailSend_campaignId_senderId_createdAt_idx";

-- DropIndex
DROP INDEX "Lead_campaignId_status_idx";

-- DropIndex
DROP INDEX "SenderAccount_email_key";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "campaign_name",
DROP COLUMN "contacts",
DROP COLUMN "counts",
DROP COLUMN "csvFile",
DROP COLUMN "csvSettings",
DROP COLUMN "email_campaign_settings_id",
DROP COLUMN "schedule",
DROP COLUMN "sequencesIds",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "includeUnsubscribeLink" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Untitled Campaign',
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "trackClicks" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trackOpens" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unsubscribeText" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET NOT NULL;

-- AlterTable
ALTER TABLE "CampaignAnalytics" DROP COLUMN "bounced_count",
DROP COLUMN "clicked_count",
DROP COLUMN "opened_count",
DROP COLUMN "orgId",
DROP COLUMN "positive_reply_count",
DROP COLUMN "replied_count",
DROP COLUMN "sent_count",
ADD COLUMN     "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "bouncedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "clickedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "openRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "openedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repliedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "replyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalLeads" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unsubscribedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CampaignRuntime" DROP CONSTRAINT "CampaignRuntime_pkey",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "CampaignRuntime_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "EmailSend" DROP COLUMN "error",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "sequenceId" TEXT,
ADD COLUMN     "sequenceStep" INTEGER,
ADD COLUMN     "threadId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "campaignId",
DROP COLUMN "status",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "customFields" JSONB,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isUnsubscribed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "zip" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "OrganizationPlan" DROP COLUMN "senderAccountsInUse",
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "includeAiCampaignGen",
DROP COLUMN "includeAiImprovement",
DROP COLUMN "includeAiResponses",
DROP COLUMN "includeAiTagging",
DROP COLUMN "includeEmailVerification",
DROP COLUMN "includeEmailWarmup",
DROP COLUMN "includeTeammates",
DROP COLUMN "includeUnifiedInbox",
DROP COLUMN "includeWebsiteLinkWarmup",
DROP COLUMN "maxLeadListPerMonth",
DROP COLUMN "maxLiveCampaigns",
DROP COLUMN "offer",
DROP COLUMN "priceUsd",
DROP COLUMN "supportType",
ADD COLUMN     "hasAdvancedAnalytics" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasApiAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCustomDomain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasEmailVerification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasEmailWarmup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hasPrioritySupport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasUnifiedInbox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxCampaigns" INTEGER,
ADD COLUMN     "maxLeadsPerMonth" INTEGER,
ADD COLUMN     "maxUsers" INTEGER,
ADD COLUMN     "priceMonthly" DECIMAL(65,30),
ADD COLUMN     "priceYearly" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "SenderAccount" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "hourlyLimit" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minDelaySeconds" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "provider" "EmailProvider" NOT NULL DEFAULT 'SMTP',
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "signature" TEXT,
ADD COLUMN     "tokenExpiry" TIMESTAMP(3),
ADD COLUMN     "warmupDailyIncrement" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "warmupStartedAt" TIMESTAMP(3),
ADD COLUMN     "warmupStatus" "WarmupStatus" NOT NULL DEFAULT 'NOT_STARTED',
ALTER COLUMN "smtpHost" DROP NOT NULL,
ALTER COLUMN "smtpPort" DROP NOT NULL,
ALTER COLUMN "smtpUser" DROP NOT NULL,
ALTER COLUMN "smtpPass" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SenderRuntime" DROP CONSTRAINT "SenderRuntime_pkey",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hourKey" TEXT,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "sentThisHour" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "SenderRuntime_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP COLUMN "activationTokenExpires",
DROP COLUMN "online",
DROP COLUMN "resetTokenExpires",
DROP COLUMN "schedule",
DROP COLUMN "verified",
ADD COLUMN     "activationTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- DropTable
DROP TABLE "CampaignFolder";

-- DropTable
DROP TABLE "CampaignFolderMapping";

-- DropTable
DROP TABLE "CampaignTriggerLog";

-- DropTable
DROP TABLE "Contact";

-- DropTable
DROP TABLE "EmailCampaign";

-- DropTable
DROP TABLE "EmailCampaignSettings";

-- DropTable
DROP TABLE "EmailTriggerLog";

-- DropTable
DROP TABLE "Sequences";

-- DropTable
DROP TABLE "TrackEmails";

-- DropTable
DROP TABLE "access_token";

-- DropEnum
DROP TYPE "SeqType";

-- DropEnum
DROP TYPE "SequenceSchedularType";

-- DropEnum
DROP TYPE "SupportType";

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSender" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "type" "SequenceType" NOT NULL DEFAULT 'EMAIL',
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "taskTitle" TEXT,
    "taskDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "currentSequenceStep" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "lastClickedAt" TIMESTAMP(3),
    "lastRepliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "linkUrl" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSendId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_token_key" ON "AccessToken"("token");

-- CreateIndex
CREATE INDEX "AccessToken_token_idx" ON "AccessToken"("token");

-- CreateIndex
CREATE INDEX "AccessToken_userId_idx" ON "AccessToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");

-- CreateIndex
CREATE INDEX "CampaignSender_campaignId_idx" ON "CampaignSender"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSender_campaignId_senderId_key" ON "CampaignSender"("campaignId", "senderId");

-- CreateIndex
CREATE INDEX "Sequence_campaignId_idx" ON "Sequence"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_campaignId_stepNumber_key" ON "Sequence"("campaignId", "stepNumber");

-- CreateIndex
CREATE INDEX "CampaignLead_campaignId_status_idx" ON "CampaignLead"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignLead_campaignId_nextSendAt_idx" ON "CampaignLead"("campaignId", "nextSendAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLead_campaignId_leadId_key" ON "CampaignLead"("campaignId", "leadId");

-- CreateIndex
CREATE INDEX "EmailEvent_emailSendId_idx" ON "EmailEvent"("emailSendId");

-- CreateIndex
CREATE INDEX "EmailEvent_leadId_type_idx" ON "EmailEvent"("leadId", "type");

-- CreateIndex
CREATE INDEX "EmailEvent_timestamp_idx" ON "EmailEvent"("timestamp");

-- CreateIndex
CREATE INDEX "Campaign_orgId_status_idx" ON "Campaign"("orgId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_createdAt_idx" ON "Campaign"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRuntime_campaignId_key" ON "CampaignRuntime"("campaignId");

-- CreateIndex
CREATE INDEX "EmailSend_campaignId_status_idx" ON "EmailSend"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EmailSend_senderId_createdAt_idx" ON "EmailSend"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSend_status_queuedAt_idx" ON "EmailSend"("status", "queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSend_campaignId_leadId_sequenceStep_key" ON "EmailSend"("campaignId", "leadId", "sequenceStep");

-- CreateIndex
CREATE INDEX "Lead_orgId_email_idx" ON "Lead"("orgId", "email");

-- CreateIndex
CREATE INDEX "Lead_orgId_isUnsubscribed_idx" ON "Lead"("orgId", "isUnsubscribed");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_orgId_email_key" ON "Lead"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");

-- CreateIndex
CREATE INDEX "Organization_domain_idx" ON "Organization"("domain");

-- CreateIndex
CREATE INDEX "OrganizationPlan_orgId_idx" ON "OrganizationPlan"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPlan_orgId_isActive_key" ON "OrganizationPlan"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "SenderAccount_orgId_isEnabled_idx" ON "SenderAccount"("orgId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "SenderAccount_orgId_email_key" ON "SenderAccount"("orgId", "email");

-- CreateIndex
CREATE INDEX "SenderRuntime_senderId_dayKey_idx" ON "SenderRuntime"("senderId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "SenderRuntime_senderId_dayKey_key" ON "SenderRuntime"("senderId", "dayKey");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderAccount" ADD CONSTRAINT "SenderAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderRuntime" ADD CONSTRAINT "SenderRuntime_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "SenderAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSender" ADD CONSTRAINT "CampaignSender_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSender" ADD CONSTRAINT "CampaignSender_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "SenderAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "SenderAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "EmailSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
