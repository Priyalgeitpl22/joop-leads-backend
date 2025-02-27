/*
  Warnings:

  - The `sender_accounts` column on the `EmailCampaignSettings` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "EmailCampaignSettings" DROP COLUMN "sender_accounts",
ADD COLUMN     "sender_accounts" TEXT[];
