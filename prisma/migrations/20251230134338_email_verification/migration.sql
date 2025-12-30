-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SAFE', 'INVALID', 'DISABLED', 'DISPOSABLE', 'INBOX_FULL', 'CATCH_ALL', 'ROLE_ACCOUNT', 'SPAMTRAP', 'UNKNOWN');

-- CreateTable
CREATE TABLE "email_verification_batches" (
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

    CONSTRAINT "email_verification_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_emails" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailStatus",
    "verificationResult" JSONB,
    "username" TEXT,
    "domain" TEXT,
    "isSafeToSend" BOOLEAN,
    "isValidSyntax" BOOLEAN,
    "isDisposable" BOOLEAN,
    "isRoleAccount" BOOLEAN,
    "canConnectSmtp" BOOLEAN,
    "hasInboxFull" BOOLEAN,
    "isCatchAll" BOOLEAN,
    "isDeliverable" BOOLEAN,
    "isDisabled" BOOLEAN,
    "isSpamtrap" BOOLEAN,
    "mxAcceptsMail" BOOLEAN,
    "mxRecords" TEXT[],
    "verificationMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verified_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_batches_orgId_idx" ON "email_verification_batches"("orgId");

-- CreateIndex
CREATE INDEX "email_verification_batches_uploadedById_idx" ON "email_verification_batches"("uploadedById");

-- CreateIndex
CREATE INDEX "verified_emails_batchId_idx" ON "verified_emails"("batchId");

-- CreateIndex
CREATE INDEX "verified_emails_email_idx" ON "verified_emails"("email");

-- CreateIndex
CREATE INDEX "verified_emails_status_idx" ON "verified_emails"("status");

-- AddForeignKey
ALTER TABLE "email_verification_batches" ADD CONSTRAINT "email_verification_batches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_batches" ADD CONSTRAINT "email_verification_batches_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_emails" ADD CONSTRAINT "verified_emails_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "email_verification_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
