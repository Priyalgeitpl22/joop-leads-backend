-- CreateEnum
CREATE TYPE "TriggerStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'SKIPPED', 'NO_PENDING', 'OUTSIDE_SCHEDULE', 'DAILY_LIMIT', 'ERROR');

-- CreateTable
CREATE TABLE "CampaignTriggerLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL,
    "nextTriggerAt" TIMESTAMP(3),
    "totalEmailsSent" INTEGER NOT NULL DEFAULT 0,
    "newLeadEmails" INTEGER NOT NULL DEFAULT 0,
    "followUpEmails" INTEGER NOT NULL DEFAULT 0,
    "status" "TriggerStatus" NOT NULL DEFAULT 'SUCCESS',
    "activityLog" TEXT,
    "senderDetails" JSONB,
    "leadDetails" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignTriggerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignTriggerLog_campaignId_triggeredAt_idx" ON "CampaignTriggerLog"("campaignId", "triggeredAt");

-- CreateIndex
CREATE INDEX "CampaignTriggerLog_triggeredAt_idx" ON "CampaignTriggerLog"("triggeredAt");

-- AddForeignKey
ALTER TABLE "CampaignTriggerLog" ADD CONSTRAINT "CampaignTriggerLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
