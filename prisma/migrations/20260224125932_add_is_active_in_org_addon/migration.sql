-- AlterTable
ALTER TABLE "OrganizationAddOn" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrganizationPlan" ALTER COLUMN "isActive" SET DEFAULT false;
