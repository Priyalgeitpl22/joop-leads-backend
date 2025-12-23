/*
  Warnings:

  - A unique constraint covering the columns `[accountId,email]` on the table `SenderAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "SenderAccount_orgId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "SenderAccount_accountId_email_key" ON "SenderAccount"("accountId", "email");
