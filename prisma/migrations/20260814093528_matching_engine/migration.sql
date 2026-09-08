-- CreateEnum
CREATE TYPE "MatchBand" AS ENUM ('STRONG', 'POSSIBLE', 'WEAK');

-- CreateEnum
CREATE TYPE "MatchTier" AS ENUM ('METADATA', 'CHARACTERIZATION', 'DIAGNOSTICS');

-- CreateEnum
CREATE TYPE "MatchSideState" AS ENUM ('NEW', 'VIEWED', 'SAVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "MatchRunTrigger" AS ENUM ('ON_DEMAND', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "MatchRunScope" AS ENUM ('SINGLE_STUDY', 'SINGLE_DATASET', 'USER', 'DELTA', 'FULL');

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "datasetVersionId" TEXT,
    "score" INTEGER NOT NULL,
    "band" "MatchBand" NOT NULL,
    "tier" "MatchTier" NOT NULL DEFAULT 'METADATA',
    "rationale" JSONB NOT NULL,
    "studyOwnerState" "MatchSideState" NOT NULL DEFAULT 'NEW',
    "siteOwnerState" "MatchSideState" NOT NULL DEFAULT 'NEW',
    "matchRunId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRun" (
    "id" TEXT NOT NULL,
    "trigger" "MatchRunTrigger" NOT NULL,
    "scope" "MatchRunScope" NOT NULL,
    "targetId" TEXT,
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "evaluatedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_studyId_idx" ON "Match"("studyId");

-- CreateIndex
CREATE INDEX "Match_datasetId_idx" ON "Match"("datasetId");

-- CreateIndex
CREATE INDEX "Match_band_idx" ON "Match"("band");

-- CreateIndex
CREATE UNIQUE INDEX "Match_studyId_datasetId_key" ON "Match"("studyId", "datasetId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "MatchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
