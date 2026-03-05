-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('CREDENTIALS', 'GOOGLE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "providerType" "AuthProvider" NOT NULL DEFAULT 'CREDENTIALS';
