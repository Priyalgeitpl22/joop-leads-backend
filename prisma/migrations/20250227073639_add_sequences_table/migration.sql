-- CreateTable
CREATE TABLE "Sequences" (
    "id" TEXT NOT NULL,
    "seq_number" INTEGER,
    "sequence_schedular_type" TEXT NOT NULL,
    "seq_delay_details" JSONB,
    "seq_type" TEXT,
    "seq_variants" JSONB,
    "variant_distribution_type" TEXT,
    "campaign_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sequences_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sequences" ADD CONSTRAINT "Sequences_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
