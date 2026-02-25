-- AlterTable
ALTER TABLE "SenderAccount" ADD COLUMN     "errorDetails" JSONB,
ADD COLUMN     "errorReason" TEXT,
ADD COLUMN     "erroredAt" TIMESTAMP(3);
