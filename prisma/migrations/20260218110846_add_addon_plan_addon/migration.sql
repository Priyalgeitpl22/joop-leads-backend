-- CreateEnum
CREATE TYPE "AddOnCode" AS ENUM ('EMAIL_VERIFICATION');

-- CreateTable
CREATE TABLE "AddOn" (
    "id" SERIAL NOT NULL,
    "code" "AddOnCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" DECIMAL(65,30),
    "priceYearly" DECIMAL(65,30),
    "emailVerificationLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAddOn" (
    "planId" INTEGER NOT NULL,
    "addOnId" INTEGER NOT NULL,

    CONSTRAINT "PlanAddOn_pkey" PRIMARY KEY ("planId","addOnId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AddOn_code_key" ON "AddOn"("code");

-- CreateIndex
CREATE INDEX "PlanAddOn_planId_idx" ON "PlanAddOn"("planId");

-- CreateIndex
CREATE INDEX "PlanAddOn_addOnId_idx" ON "PlanAddOn"("addOnId");

-- AddForeignKey
ALTER TABLE "PlanAddOn" ADD CONSTRAINT "PlanAddOn_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAddOn" ADD CONSTRAINT "PlanAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
