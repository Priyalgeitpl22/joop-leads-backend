-- CreateTable
CREATE TABLE "EmailTriggerLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTriggerLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmailTriggerLog" ADD CONSTRAINT "EmailTriggerLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTriggerLog" ADD CONSTRAINT "EmailTriggerLog_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
