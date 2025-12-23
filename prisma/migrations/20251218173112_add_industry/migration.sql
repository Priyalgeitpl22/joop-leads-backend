/*
  Warnings:

  - You are about to drop the column `jobTitle` on the `Lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "jobTitle",
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "industry" TEXT;
