/*
  Warnings:

  - You are about to drop the column `folderId` on the `Campaign` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_folderId_fkey";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "folderId";

-- CreateTable
CREATE TABLE "CampaignFolderMapping" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,

    CONSTRAINT "CampaignFolderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignFolderMapping_campaignId_folderId_key" ON "CampaignFolderMapping"("campaignId", "folderId");

-- AddForeignKey
ALTER TABLE "CampaignFolderMapping" ADD CONSTRAINT "CampaignFolderMapping_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFolderMapping" ADD CONSTRAINT "CampaignFolderMapping_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CampaignFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
