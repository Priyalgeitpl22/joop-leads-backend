/*
  Warnings:

  - You are about to drop the column `csv_file` on the `Contacts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contacts" DROP COLUMN "csv_file";

-- AlterTable
ALTER TABLE "email_campaign" ADD COLUMN     "csv_file" TEXT;
