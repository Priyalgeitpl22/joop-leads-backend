-- CreateEnum
CREATE TYPE "SenderAccountState" AS ENUM ('active', 'inactive', 'verified', 'unverified', 'pending', 'disabled', 'deleted', 'reauth_required');

-- AlterTable
ALTER TABLE "SenderAccount" ALTER COLUMN "minDelaySeconds" SET DEFAULT 300;

-- AlterTable
ALTER TABLE "SenderRuntime" ADD COLUMN     "state" "SenderAccountState" NOT NULL DEFAULT 'pending';
