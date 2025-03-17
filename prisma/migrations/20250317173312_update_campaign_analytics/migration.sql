/*
  Warnings:

  - A unique constraint covering the columns `[campaignId,email]` on the table `CampaignAnalytics` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CampaignAnalytics" ALTER COLUMN "opened_count" SET DEFAULT 0,
ALTER COLUMN "clicked_count" SET DEFAULT 0,
ALTER COLUMN "replied_count" SET DEFAULT 0,
ALTER COLUMN "positive_reply_count" SET DEFAULT 0,
ALTER COLUMN "bounced_count" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAnalytics_campaignId_email_key" ON "CampaignAnalytics"("campaignId", "email");
