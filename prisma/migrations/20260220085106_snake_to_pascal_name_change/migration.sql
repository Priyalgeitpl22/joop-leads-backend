/*
  Warnings:

  - You are about to drop the `email_verification_batches` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verified_emails` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "email_verification_batches" DROP CONSTRAINT "email_verification_batches_orgId_fkey";

-- DropForeignKey
ALTER TABLE "email_verification_batches" DROP CONSTRAINT "email_verification_batches_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "verified_emails" DROP CONSTRAINT "verified_emails_batchId_fkey";

-- DropTable
DROP TABLE "email_verification_batches";

-- DropTable
DROP TABLE "verified_emails";

-- CreateTable
CREATE TABLE "EmailVerificationBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalEmails" INTEGER NOT NULL,
    "verifiedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "reoonTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "EmailVerificationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedEmail" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailStatus",
    "username" TEXT,
    "domain" TEXT,
    "isSafeToSend" BOOLEAN,
    "isDeliverable" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerificationBatch_orgId_idx" ON "EmailVerificationBatch"("orgId");

-- CreateIndex
CREATE INDEX "EmailVerificationBatch_uploadedById_idx" ON "EmailVerificationBatch"("uploadedById");

-- CreateIndex
CREATE INDEX "VerifiedEmail_batchId_idx" ON "VerifiedEmail"("batchId");

-- CreateIndex
CREATE INDEX "VerifiedEmail_email_idx" ON "VerifiedEmail"("email");

-- CreateIndex
CREATE INDEX "VerifiedEmail_status_idx" ON "VerifiedEmail"("status");

-- AddForeignKey
ALTER TABLE "EmailVerificationBatch" ADD CONSTRAINT "EmailVerificationBatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationBatch" ADD CONSTRAINT "EmailVerificationBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedEmail" ADD CONSTRAINT "VerifiedEmail_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "EmailVerificationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
