-- AlterTable
ALTER TABLE "EmailCampaign" ADD COLUMN     "emailAccountUsed" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastSequenceSent" TEXT NOT NULL DEFAULT '';
