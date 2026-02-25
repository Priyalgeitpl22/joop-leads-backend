/*
  Warnings:

  - You are about to drop the column `state` on the `SenderRuntime` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SenderAccount" ADD COLUMN     "state" "SenderAccountState" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "SenderRuntime" DROP COLUMN "state";
