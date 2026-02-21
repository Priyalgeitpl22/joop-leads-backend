/*
  Warnings:

  - You are about to drop the column `overall_score` on the `SingleEmailVerification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SingleEmailVerification" DROP COLUMN "overall_score",
ADD COLUMN     "overallScore" INTEGER NOT NULL DEFAULT 0;
