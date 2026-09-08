// Matching core (DB-facing). One pure scorer (signals.ts) drives both the
// on-demand button and (later) the overnight job. Idempotent upserts; matches
// below POSSIBLE are removed so the table stays meaningful.
//
// Visibility model: matches are stored liberally (from whichever side runs), and
// re-filtered by the viewer's actual visibility at READ time (see the dashboard).

import { prisma } from "@/lib/prisma";
import { scorePair, type StudyInput, type DatasetInput } from "./signals";

const MIN_SCORE = 40; // store POSSIBLE (≥40) and STRONG (≥70); drop WEAK

export interface RunCounters {
  evaluated: number;
  created: number;
  updated: number;
  removed: number;
}

function newCounters(): RunCounters {
  return { evaluated: 0, created: 0, updated: 0, removed: 0 };
}

// Datasets a given user may see AND that have a usable (PUBLISHED) CDM release.
function datasetVisibleWhere(ownerId: string) {
  return {
    AND: [
      { releases: { some: { status: "PUBLISHED" as const } } },
      {
        OR: [
          { visibility: "AUTHENTICATED" as const, approvalStatus: "APPROVED" as const },
          { site: { ownerId } },
          { site: { members: { some: { userId: ownerId } } } },
        ],
      },
    ],
  };
}

function studyVisibleWhere(ownerId: string) {
  return {
    OR: [
      { visibility: "AUTHENTICATED" as const, approvalStatus: "APPROVED" as const },
      { ownerId },
      { members: { some: { userId: ownerId } } },
    ],
  };
}

type StudyRow = StudyInput & { id: string };
type DatasetRow = DatasetInput & {
  id: string;
  releases: { id: string }[];
};

async function upsertOrRemove(
  study: StudyRow,
  dataset: DatasetRow,
  matchRunId: string,
  counters: RunCounters,
) {
  counters.evaluated += 1;
  const res = scorePair(study, dataset);
  const datasetReleaseId = dataset.releases[0]?.id ?? null;

  if (res.score < MIN_SCORE) {
    const del = await prisma.match.deleteMany({
      where: { studyId: study.id, datasetId: dataset.id },
    });
    counters.removed += del.count;
    return;
  }

  const existing = await prisma.match.findUnique({
    where: { studyId_datasetId: { studyId: study.id, datasetId: dataset.id } },
    select: { id: true },
  });

  await prisma.match.upsert({
    where: { studyId_datasetId: { studyId: study.id, datasetId: dataset.id } },
    // create sets fresh triage state (NEW/NEW); update preserves it.
    create: {
      studyId: study.id,
      datasetId: dataset.id,
      datasetReleaseId,
      score: res.score,
      band: res.band as never,
      tier: "METADATA" as never,
      rationale: res as never,
      matchRunId,
    },
    update: {
      score: res.score,
      band: res.band as never,
      rationale: res as never,
      datasetReleaseId,
      computedAt: new Date(),
      matchRunId,
    },
  });

  if (existing) counters.updated += 1;
  else counters.created += 1;
}

/** Match one study against every dataset its owner may use. */
export async function computeForStudy(
  studyId: string,
  matchRunId: string,
  counters: RunCounters,
) {
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study) return;
  const datasets = await prisma.dataset.findMany({
    where: datasetVisibleWhere(study.ownerId),
    include: {
      releases: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  for (const d of datasets) {
    await upsertOrRemove(study, d, matchRunId, counters);
  }
}

/** Match one dataset against every study its site owner may see. */
export async function computeForDataset(
  datasetId: string,
  matchRunId: string,
  counters: RunCounters,
) {
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      site: { select: { ownerId: true } },
      releases: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!dataset || dataset.releases.length === 0) return; // no usable CDM → no matches
  const studies = await prisma.study.findMany({
    where: studyVisibleWhere(dataset.site.ownerId),
  });
  for (const s of studies) {
    await upsertOrRemove(s, dataset, matchRunId, counters);
  }
}

/**
 * Recompute matches across everything a user owns/manages — both their studies
 * (vs datasets they can use) and their datasets (vs studies they can see).
 * Backs the "Run matching now" button.
 */
export async function runMatchingForUser(
  userId: string,
  trigger: "ON_DEMAND" | "SCHEDULED" = "ON_DEMAND",
): Promise<RunCounters> {
  const run = await prisma.matchRun.create({
    data: {
      trigger: trigger as never,
      scope: "USER" as never,
      targetId: userId,
      triggeredById: userId,
    },
  });
  const counters = newCounters();

  const myStudies = await prisma.study.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  for (const s of myStudies) {
    await computeForStudy(s.id, run.id, counters);
  }

  const myDatasets = await prisma.dataset.findMany({
    where: {
      OR: [
        { site: { ownerId: userId } },
        { site: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  });
  for (const d of myDatasets) {
    await computeForDataset(d.id, run.id, counters);
  }

  await prisma.matchRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      evaluatedCount: counters.evaluated,
      createdCount: counters.created,
      updatedCount: counters.updated,
      removedCount: counters.removed,
    },
  });

  return counters;
}
