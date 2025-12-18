/*
  Warnings:

  - You are about to drop the column `campaignName` on the `Campaign` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "campaignName",
ADD COLUMN     "campaign_name" TEXT NOT NULL DEFAULT 'Untitled Campaign';
