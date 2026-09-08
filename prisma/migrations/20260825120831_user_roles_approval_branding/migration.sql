-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('USER', 'COORDINATOR', 'SUPERUSER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Study" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "systemRole" "SystemRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL DEFAULT 'Evidence Network',
    "tagline" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#A6CE39',
    "logo" BYTEA,
    "logoMimeType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grandfather existing records: anything already set to AUTHENTICATED visibility
-- is treated as already approved (pre-approval-workflow data).
UPDATE "Study" SET "approvalStatus" = 'APPROVED', "reviewedAt" = CURRENT_TIMESTAMP WHERE "visibility" = 'AUTHENTICATED';
UPDATE "Dataset" SET "approvalStatus" = 'APPROVED', "reviewedAt" = CURRENT_TIMESTAMP WHERE "visibility" = 'AUTHENTICATED';
