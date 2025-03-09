/*
  Warnings:

  - You are about to drop the column `aiOrgId` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `aiOrgId` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "aiOrgId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "aiOrgId";
