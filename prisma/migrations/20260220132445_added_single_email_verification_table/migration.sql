-- CreateTable
CREATE TABLE "SingleEmailVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailStatus",
    "username" TEXT,
    "domain" TEXT,
    "isSafeToSend" BOOLEAN,
    "isDeliverable" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,

    CONSTRAINT "SingleEmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SingleEmailVerification_orgId_idx" ON "SingleEmailVerification"("orgId");

-- CreateIndex
CREATE INDEX "SingleEmailVerification_verifiedById_idx" ON "SingleEmailVerification"("verifiedById");

-- CreateIndex
CREATE INDEX "SingleEmailVerification_email_idx" ON "SingleEmailVerification"("email");

-- CreateIndex
CREATE INDEX "SingleEmailVerification_status_idx" ON "SingleEmailVerification"("status");

-- AddForeignKey
ALTER TABLE "SingleEmailVerification" ADD CONSTRAINT "SingleEmailVerification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleEmailVerification" ADD CONSTRAINT "SingleEmailVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
