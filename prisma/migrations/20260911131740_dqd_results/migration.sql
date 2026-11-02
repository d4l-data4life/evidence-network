-- CreateTable
CREATE TABLE "DqdResult" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByKeyId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "dqdVersion" TEXT,
    "cdmVersion" TEXT,
    "vocabularyVersion" TEXT,
    "executionDate" TIMESTAMP(3),
    "countTotal" INTEGER NOT NULL,
    "countPassed" INTEGER NOT NULL,
    "countFailed" INTEGER NOT NULL,
    "countError" INTEGER NOT NULL,
    "countNotApplicable" INTEGER NOT NULL,
    "pctPassed" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "warnings" JSONB,
    "payload" BYTEA NOT NULL,
    "payloadBytes" INTEGER NOT NULL,

    CONSTRAINT "DqdResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DqdResult_releaseId_supersededAt_idx" ON "DqdResult"("releaseId", "supersededAt");

-- AddForeignKey
ALTER TABLE "DqdResult" ADD CONSTRAINT "DqdResult_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "DatasetRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
