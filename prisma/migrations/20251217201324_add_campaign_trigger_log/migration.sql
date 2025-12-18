-- AlterTable: Add timezone column with default value for existing rows
ALTER TABLE "EmailTriggerLog" ADD COLUMN     "timezone" TEXT;
UPDATE "EmailTriggerLog" SET "timezone" = 'UTC' WHERE "timezone" IS NULL;
ALTER TABLE "EmailTriggerLog" ALTER COLUMN "timezone" SET NOT NULL;

-- CreateTable
CREATE TABLE "CampaignTriggerLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "newEmailsSent" INTEGER NOT NULL DEFAULT 0,
    "followUpEmailsSent" INTEGER NOT NULL DEFAULT 0,
    "totalEligibleEmailAccounts" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignTriggerLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CampaignTriggerLog" ADD CONSTRAINT "CampaignTriggerLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTriggerLog" ADD CONSTRAINT "CampaignTriggerLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
