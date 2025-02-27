/*
  Warnings:

  - The `sequence_schedular_type` column on the `Sequences` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `seq_type` column on the `Sequences` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SeqType" AS ENUM ('EMAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "SequenceSchedularType" AS ENUM ('AUTOMATIC', 'MANUAL');

-- AlterTable
ALTER TABLE "Sequences" DROP COLUMN "sequence_schedular_type",
ADD COLUMN     "sequence_schedular_type" "SequenceSchedularType",
DROP COLUMN "seq_type",
ADD COLUMN     "seq_type" "SeqType";
