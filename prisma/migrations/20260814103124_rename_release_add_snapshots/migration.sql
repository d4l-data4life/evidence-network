-- Rename the OMOP data-cut model DatasetVersion -> DatasetRelease (preserve data)
ALTER TYPE "DatasetVersionStatus" RENAME TO "DatasetReleaseStatus";
ALTER TABLE "DatasetVersion" RENAME TO "DatasetRelease";
ALTER TABLE "DatasetRelease" RENAME CONSTRAINT "DatasetVersion_pkey" TO "DatasetRelease_pkey";
ALTER TABLE "DatasetRelease" RENAME CONSTRAINT "DatasetVersion_datasetId_fkey" TO "DatasetRelease_datasetId_fkey";
ALTER INDEX "DatasetVersion_datasetId_idx" RENAME TO "DatasetRelease_datasetId_idx";
ALTER INDEX "DatasetVersion_datasetId_label_key" RENAME TO "DatasetRelease_datasetId_label_key";

-- Match: rename the reference column
ALTER TABLE "Match" RENAME COLUMN "datasetVersionId" TO "datasetReleaseId";

-- New: SiteVersion (immutable site-metadata snapshots)
CREATE TABLE "SiteVersion" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "legalName" TEXT NOT NULL,
    "abbreviation" TEXT,
    "country" TEXT NOT NULL,
    "orgType" "SiteOrgType" NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "governancePolicy" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SiteVersion_siteId_idx" ON "SiteVersion"("siteId");
CREATE UNIQUE INDEX "SiteVersion_siteId_versionNumber_key" ON "SiteVersion"("siteId", "versionNumber");
ALTER TABLE "SiteVersion" ADD CONSTRAINT "SiteVersion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteVersion" ADD CONSTRAINT "SiteVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New: DatasetVersion (immutable dataset catalog-metadata snapshots; reuses freed name)
CREATE TABLE "DatasetVersion" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "sourceType" "DatasetSourceType" NOT NULL,
    "careSetting" "DatasetCareSetting"[],
    "therapeuticAreas" TEXT[],
    "sourceCodingSystems" TEXT[],
    "description" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DatasetVersion_datasetId_idx" ON "DatasetVersion"("datasetId");
CREATE UNIQUE INDEX "DatasetVersion_datasetId_versionNumber_key" ON "DatasetVersion"("datasetId", "versionNumber");
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
