-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "autoPauseOnHighBounce" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoPauseSameDomain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bounceRateThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN     "sendAsPlainText" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sendingPriority" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "stopOnClick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stopOnOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stopOnReply" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CampaignLead" ADD COLUMN     "isStopped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stoppedAt" TIMESTAMP(3),
ADD COLUMN     "stoppedReason" TEXT;
