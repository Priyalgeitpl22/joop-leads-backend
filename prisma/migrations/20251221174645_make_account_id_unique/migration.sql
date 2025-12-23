/*
  Warnings:

  - A unique constraint covering the columns `[accountId]` on the table `SenderAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SenderAccount_accountId_key" ON "SenderAccount"("accountId");
