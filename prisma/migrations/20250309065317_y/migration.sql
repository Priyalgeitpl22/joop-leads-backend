/*
  Warnings:

  - You are about to drop the column `active` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `campaignName` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `contacts` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `csvFile` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `csvSettings` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `email_campaign_settings_id` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `schedule` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `sequencesIds` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `EmailCampaign` table. All the data in the column will be lost.
  - You are about to drop the `ChatConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Thread` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `orgId` on table `Contact` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `campaignId` to the `EmailCampaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contactId` to the `EmailCampaign` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "EmailCampaignSettings" DROP CONSTRAINT "EmailCampaignSettings_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_threadId_fkey";

-- DropForeignKey
ALTER TABLE "Sequences" DROP CONSTRAINT "Sequences_campaign_id_fkey";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "active",
ALTER COLUMN "orgId" SET NOT NULL;

-- AlterTable
ALTER TABLE "EmailCampaign" DROP COLUMN "campaignName",
DROP COLUMN "contacts",
DROP COLUMN "createdAt",
DROP COLUMN "csvFile",
DROP COLUMN "csvSettings",
DROP COLUMN "email_campaign_settings_id",
DROP COLUMN "schedule",
DROP COLUMN "sequencesIds",
DROP COLUMN "status",
ADD COLUMN     "campaignId" TEXT NOT NULL,
ADD COLUMN     "contactId" TEXT NOT NULL;

-- DropTable
DROP TABLE "ChatConfig";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "Thread";

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "csvSettings" JSONB,
    "csvFile" TEXT,
    "schedule" JSONB,
    "contacts" TEXT[],
    "sequencesIds" TEXT[],
    "status" TEXT DEFAULT 'DRAFT',
    "email_campaign_settings_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequences" ADD CONSTRAINT "Sequences_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignSettings" ADD CONSTRAINT "EmailCampaignSettings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
