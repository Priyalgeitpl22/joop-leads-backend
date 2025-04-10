/*
  Warnings:

  - You are about to drop the column `email_licked` on the `EmailTriggerLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EmailTriggerLog" DROP COLUMN "email_licked",
ADD COLUMN     "email_clicked" BOOLEAN DEFAULT false;
