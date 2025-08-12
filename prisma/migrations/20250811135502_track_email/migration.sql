-- CreateTable
CREATE TABLE "TrackEmails" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,

    CONSTRAINT "TrackEmails_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrackEmails" ADD CONSTRAINT "TrackEmails_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
