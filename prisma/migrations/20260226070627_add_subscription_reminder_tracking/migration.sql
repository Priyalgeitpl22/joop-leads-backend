-- AlterTable
ALTER TABLE "OrganizationPlan" ADD COLUMN     "reminder10Sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder15Sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder1Sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder5Sent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SubscriptionReminderLog" (
    "id" SERIAL NOT NULL,
    "orgId" TEXT NOT NULL,
    "orgPlanId" INTEGER NOT NULL,
    "reminderStage" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientEmail" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "SubscriptionReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionReminderLog_orgId_idx" ON "SubscriptionReminderLog"("orgId");

-- CreateIndex
CREATE INDEX "SubscriptionReminderLog_orgPlanId_idx" ON "SubscriptionReminderLog"("orgPlanId");

-- AddForeignKey
ALTER TABLE "SubscriptionReminderLog" ADD CONSTRAINT "SubscriptionReminderLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
