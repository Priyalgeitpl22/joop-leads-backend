-- AddForeignKey
ALTER TABLE "CampaignRuntime" ADD CONSTRAINT "CampaignRuntime_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
