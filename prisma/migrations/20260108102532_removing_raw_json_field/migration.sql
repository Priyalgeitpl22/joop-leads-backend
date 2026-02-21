/*
  Warnings:

  - You are about to drop the column `rawResult` on the `email_verification_batches` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "email_verification_batches" DROP COLUMN "rawResult";
