-- AlterTable
ALTER TABLE "Contacts" ADD COLUMN     "email_campaignId" TEXT;

-- AddForeignKey
ALTER TABLE "Contacts" ADD CONSTRAINT "Contacts_email_campaignId_fkey" FOREIGN KEY ("email_campaignId") REFERENCES "email_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
