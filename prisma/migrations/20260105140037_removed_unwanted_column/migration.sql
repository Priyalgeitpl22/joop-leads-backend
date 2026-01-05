/*
  Warnings:

  - You are about to drop the column `canConnectSmtp` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `hasInboxFull` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `isCatchAll` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `isDisabled` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `isDisposable` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `isRoleAccount` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `isSpamtrap` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `isValidSyntax` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `mxAcceptsMail` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `verificationMode` on the `verified_emails` table. All the data in the column will be lost.
  - You are about to drop the column `verificationResult` on the `verified_emails` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "verified_emails" DROP COLUMN "canConnectSmtp",
DROP COLUMN "hasInboxFull",
DROP COLUMN "isCatchAll",
DROP COLUMN "isDisabled",
DROP COLUMN "isDisposable",
DROP COLUMN "isRoleAccount",
DROP COLUMN "isSpamtrap",
DROP COLUMN "isValidSyntax",
DROP COLUMN "mxAcceptsMail",
DROP COLUMN "verificationMode",
DROP COLUMN "verificationResult";
