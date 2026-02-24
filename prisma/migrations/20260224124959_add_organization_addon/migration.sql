-- CreateTable
CREATE TABLE "OrganizationAddOn" (
    "orgId" TEXT NOT NULL,
    "addOnId" INTEGER NOT NULL,
    "limitOverride" INTEGER,
    "usedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "periodStartsAt" TIMESTAMP(3),
    "periodEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAddOn_pkey" PRIMARY KEY ("orgId","addOnId")
);

-- CreateIndex
CREATE INDEX "OrganizationAddOn_orgId_idx" ON "OrganizationAddOn"("orgId");

-- CreateIndex
CREATE INDEX "OrganizationAddOn_addOnId_idx" ON "OrganizationAddOn"("addOnId");

-- AddForeignKey
ALTER TABLE "OrganizationAddOn" ADD CONSTRAINT "OrganizationAddOn_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAddOn" ADD CONSTRAINT "OrganizationAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
