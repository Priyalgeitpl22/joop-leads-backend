/*
  Warnings:

  - Added the required column `email` to the `CampaignAnalytics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CampaignAnalytics" ADD COLUMN     "email" TEXT NOT NULL;
