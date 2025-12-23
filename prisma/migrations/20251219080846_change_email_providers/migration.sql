/*
  Warnings:

  - The values [SMTP,GMAIL_API,OUTLOOK_API,SENDGRID,AWS_SES] on the enum `EmailProvider` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EmailProvider_new" AS ENUM ('smtp', 'gmail', 'outlook');
ALTER TABLE "SenderAccount" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "SenderAccount" ALTER COLUMN "provider" TYPE "EmailProvider_new" USING ("provider"::text::"EmailProvider_new");
ALTER TYPE "EmailProvider" RENAME TO "EmailProvider_old";
ALTER TYPE "EmailProvider_new" RENAME TO "EmailProvider";
DROP TYPE "EmailProvider_old";
COMMIT;

-- AlterTable
ALTER TABLE "SenderAccount" ALTER COLUMN "provider" DROP DEFAULT;
