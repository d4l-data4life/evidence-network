
-- AlterTable
ALTER TABLE "Study" DROP COLUMN "version";

-- CreateTable
CREATE TABLE "StudyVersion" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
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
    "status" "StudyStatus" NOT NULL,
    "designRef" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyVersion_studyId_idx" ON "StudyVersion"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyVersion_studyId_versionNumber_key" ON "StudyVersion"("studyId", "versionNumber");

-- AddForeignKey
ALTER TABLE "StudyVersion" ADD CONSTRAINT "StudyVersion_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyVersion" ADD CONSTRAINT "StudyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
