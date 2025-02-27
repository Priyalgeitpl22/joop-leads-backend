/*
  Warnings:

  - You are about to drop the column `emailCampaignId` on the `Contact` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_emailCampaignId_fkey";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "emailCampaignId";

-- AlterTable
ALTER TABLE "EmailCampaign" ADD COLUMN     "contacts" TEXT[];
