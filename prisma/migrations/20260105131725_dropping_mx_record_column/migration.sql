/*
  Warnings:

  - You are about to drop the column `mxRecords` on the `verified_emails` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "verified_emails"
DROP COLUMN IF EXISTS "mxRecords";
