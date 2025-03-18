/*
  Warnings:

  - You are about to drop the column `email` on the `CampaignAnalytics` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[campaignId]` on the table `CampaignAnalytics` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CampaignAnalytics_campaignId_email_key";

-- AlterTable
ALTER TABLE "CampaignAnalytics" DROP COLUMN "email",
ADD COLUMN     "sent_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAnalytics_campaignId_key" ON "CampaignAnalytics"("campaignId");
