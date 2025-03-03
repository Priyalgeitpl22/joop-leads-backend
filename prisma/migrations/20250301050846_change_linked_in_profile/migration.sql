/*
  Warnings:

  - You are about to drop the column `linkdin_profile` on the `Contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "linkdin_profile",
ADD COLUMN     "linkedin_profile" TEXT;
