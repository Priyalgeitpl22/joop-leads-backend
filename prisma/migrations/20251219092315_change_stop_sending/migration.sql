/*
  Warnings:

  - You are about to drop the column `stopOnClick` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `stopOnOpen` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `stopOnReply` on the `Campaign` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "StopSending" AS ENUM ('CLICK', 'OPEN', 'REPLY');

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "stopOnClick",
DROP COLUMN "stopOnOpen",
DROP COLUMN "stopOnReply",
ADD COLUMN     "stopSending" "StopSending" NOT NULL DEFAULT 'REPLY';
