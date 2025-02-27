-- CreateTable
CREATE TABLE "EmailCampaignSettings" (
    "id" TEXT NOT NULL,
    "sender_accounts" TEXT[],
    "campaign_schedule" JSONB,
    "campaign_settings" JSONB,
    "campaign_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaignSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmailCampaignSettings" ADD CONSTRAINT "EmailCampaignSettings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
