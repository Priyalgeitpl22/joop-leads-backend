/*
  Warnings:

  - The `csvFile` column on the `Campaign` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "counts" JSONB,
DROP COLUMN "csvFile",
ADD COLUMN     "csvFile" JSONB;
