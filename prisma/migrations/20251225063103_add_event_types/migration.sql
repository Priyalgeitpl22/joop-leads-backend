/*
  Warnings:

  - The values [DELIVERED,COMPLAINED] on the enum `EventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventType_new" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'POSITIVE_REPLY', 'BOUNCED', 'SENDER_BOUNCED', 'UNSUBSCRIBED', 'FAILED');
ALTER TABLE "EmailEvent" ALTER COLUMN "type" TYPE "EventType_new" USING ("type"::text::"EventType_new");
ALTER TYPE "EventType" RENAME TO "EventType_old";
ALTER TYPE "EventType_new" RENAME TO "EventType";
DROP TYPE "EventType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'POSITIVE_REPLY';
ALTER TYPE "LeadStatus" ADD VALUE 'SENDER_BOUNCED';
