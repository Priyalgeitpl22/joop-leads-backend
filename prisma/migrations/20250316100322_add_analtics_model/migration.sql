-- CreateTable
CREATE TABLE "CampaignAnalytics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_count" INTEGER NOT NULL DEFAULT 1,
    "clicked_count" INTEGER NOT NULL DEFAULT 1,
    "replied_count" INTEGER NOT NULL DEFAULT 1,
    "positive_reply_count" INTEGER NOT NULL DEFAULT 1,
    "bounced_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CampaignAnalytics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CampaignAnalytics" ADD CONSTRAINT "CampaignAnalytics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
