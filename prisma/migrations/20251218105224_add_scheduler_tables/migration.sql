/*
  Warnings:

  - Added the required column `threadId` to the `EmailTriggerLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailTriggerLog" ADD COLUMN     "threadId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CampaignRuntime" (
    "campaignId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignRuntime_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "SenderRuntime" (
    "senderId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "SenderRuntime_pkey" PRIMARY KEY ("senderId","dayKey")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignRuntime_nextRunAt_idx" ON "CampaignRuntime"("nextRunAt");

-- CreateIndex
CREATE INDEX "EmailSend_campaignId_senderId_createdAt_idx" ON "EmailSend"("campaignId", "senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSend_campaignId_leadId_key" ON "EmailSend"("campaignId", "leadId");
