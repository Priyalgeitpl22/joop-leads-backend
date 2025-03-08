-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
