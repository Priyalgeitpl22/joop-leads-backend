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
ALTER TABLE "verified_emails"
  DROP COLUMN IF EXISTS "canConnectSmtp",
  DROP COLUMN IF EXISTS "hasInboxFull",
  DROP COLUMN IF EXISTS "isCatchAll",
  DROP COLUMN IF EXISTS "isDisabled",
  DROP COLUMN IF EXISTS "isDisposable",
  DROP COLUMN IF EXISTS "isRoleAccount",
  DROP COLUMN IF EXISTS "isSpamtrap",
  DROP COLUMN IF EXISTS "isValidSyntax",
  DROP COLUMN IF EXISTS "mxAcceptsMail",
  DROP COLUMN IF EXISTS "verificationMode",
  DROP COLUMN IF EXISTS "verificationResult";
