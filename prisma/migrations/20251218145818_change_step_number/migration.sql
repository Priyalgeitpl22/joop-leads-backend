/*
  Warnings:

  - You are about to drop the column `stepNumber` on the `Sequence` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[campaignId,seqNumber]` on the table `Sequence` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `seqNumber` to the `Sequence` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Sequence_campaignId_stepNumber_key";

-- AlterTable
ALTER TABLE "Sequence" DROP COLUMN "stepNumber",
ADD COLUMN     "seqNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_campaignId_seqNumber_key" ON "Sequence"("campaignId", "seqNumber");
