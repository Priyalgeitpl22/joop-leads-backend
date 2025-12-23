-- AlterTable
ALTER TABLE "SenderAccount" ADD COLUMN     "imapHost" TEXT,
ADD COLUMN     "imapPass" TEXT,
ADD COLUMN     "imapPort" INTEGER,
ADD COLUMN     "imapSecure" BOOLEAN,
ADD COLUMN     "imapUser" TEXT,
ADD COLUMN     "smtpSecure" BOOLEAN;
