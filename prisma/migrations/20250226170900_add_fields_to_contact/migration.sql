/*
  Warnings:

  - You are about to drop the column `companyName` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `csvSettings` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `fileName` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInProfile` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `Contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "companyName",
DROP COLUMN "csvSettings",
DROP COLUMN "fileName",
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "linkedInProfile",
DROP COLUMN "phoneNumber",
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "csv_setting" JSONB,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "linkdin_profile" TEXT,
ADD COLUMN     "phone_number" TEXT;
