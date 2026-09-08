-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'AUTHENTICATED');

-- CreateEnum
CREATE TYPE "StudyType" AS ENUM ('CHARACTERIZATION', 'POPULATION_LEVEL_ESTIMATION', 'PATIENT_LEVEL_PREDICTION');

-- CreateEnum
CREATE TYPE "StudyDesignType" AS ENUM ('COHORT', 'CASE_CONTROL', 'CASE_ONLY', 'CROSS_SECTIONAL', 'SELF_CONTROLLED', 'OTHER');

-- CreateEnum
CREATE TYPE "StudyScope" AS ENUM ('SAFETY', 'EFFECTIVENESS', 'DRUG_UTILISATION', 'DISEASE_EPIDEMIOLOGY', 'METHOD_DEVELOPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('DRAFT', 'PROPOSED', 'RECRUITING', 'DESIGN_FINALIZED', 'EXECUTING', 'RESULTS_AVAILABLE', 'COMPLETE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StudyRole" AS ENUM ('LEAD', 'COORDINATOR', 'DESIGNER', 'STATISTICIAN', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "SiteOrgType" AS ENUM ('ACADEMIC', 'HOSPITAL', 'REGISTRY_HOLDER', 'GOVERNMENT', 'INDUSTRY', 'NON_PROFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "SiteRole" AS ENUM ('OWNER', 'ADMIN', 'CONTRIBUTOR');

-- CreateEnum
CREATE TYPE "DatasetSourceType" AS ENUM ('EHR', 'CLAIMS', 'HOSPITAL', 'REGISTRY', 'OTHER');

-- CreateEnum
CREATE TYPE "DatasetCareSetting" AS ENUM ('PRIMARY_CARE', 'INPATIENT', 'OUTPATIENT', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "CdmVersion" AS ENUM ('V5_3', 'V5_4');

-- CreateEnum
CREATE TYPE "DatasetVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "acronym" TEXT,
    "description" TEXT,
    "rationale" TEXT,
    "objective" TEXT,
    "studyType" "StudyType" NOT NULL,
    "designType" "StudyDesignType",
    "scope" "StudyScope"[],
    "conditions" TEXT[],
    "keywords" TEXT[],
    "status" "StudyStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "designRef" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyMembership" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StudyRole" NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "abbreviation" TEXT,
    "country" TEXT NOT NULL,
    "orgType" "SiteOrgType" NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "governancePolicy" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteMembership" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SiteRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "sourceType" "DatasetSourceType" NOT NULL,
    "careSetting" "DatasetCareSetting"[],
    "therapeuticAreas" TEXT[],
    "sourceCodingSystems" TEXT[],
    "description" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cdmSourceName" TEXT,
    "cdmSourceAbbreviation" TEXT,
    "cdmHolder" TEXT,
    "sourceDescription" TEXT,
    "sourceDocumentationReference" TEXT,
    "cdmEtlReference" TEXT,
    "sourceReleaseDate" TIMESTAMP(3),
    "cdmReleaseDate" TIMESTAMP(3),
    "cdmVersion" "CdmVersion",
    "vocabularyVersion" TEXT,
    "status" "DatasetVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Study_slug_key" ON "Study"("slug");

-- CreateIndex
CREATE INDEX "Study_visibility_idx" ON "Study"("visibility");

-- CreateIndex
CREATE INDEX "Study_ownerId_idx" ON "Study"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyMembership_studyId_userId_key" ON "StudyMembership"("studyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");

-- CreateIndex
CREATE INDEX "Site_ownerId_idx" ON "Site"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteMembership_siteId_userId_key" ON "SiteMembership"("siteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_slug_key" ON "Dataset"("slug");

-- CreateIndex
CREATE INDEX "Dataset_siteId_idx" ON "Dataset"("siteId");

-- CreateIndex
CREATE INDEX "Dataset_visibility_idx" ON "Dataset"("visibility");

-- CreateIndex
CREATE INDEX "DatasetVersion_datasetId_idx" ON "DatasetVersion"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetVersion_datasetId_label_key" ON "DatasetVersion"("datasetId", "label");

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMembership" ADD CONSTRAINT "StudyMembership_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMembership" ADD CONSTRAINT "StudyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMembership" ADD CONSTRAINT "SiteMembership_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMembership" ADD CONSTRAINT "SiteMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
