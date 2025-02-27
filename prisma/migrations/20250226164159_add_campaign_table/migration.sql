-- AlterTable
ALTER TABLE "Contacts" ADD COLUMN     "csv_file" TEXT;

-- CreateTable
CREATE TABLE "email_campaign" (
    "id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "csv_setting" JSONB,
    "schedule" JSONB,

    CONSTRAINT "email_campaign_pkey" PRIMARY KEY ("id")
);
