-- AlterTable
ALTER TABLE "EmailTriggerLog" ADD COLUMN     "email_licked" BOOLEAN DEFAULT false,
ADD COLUMN     "email_opened" BOOLEAN DEFAULT false;
