-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "stoppedAt" TIMESTAMP(3),
ADD COLUMN     "stoppedDetails" JSONB;
