/*
  Warnings:

  - You are about to drop the column `csvResult` on the `EmailVerificationBatch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EmailVerificationBatch" DROP COLUMN "csvResult",
ADD COLUMN     "csvResultFile" TEXT;
