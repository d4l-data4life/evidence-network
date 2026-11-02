// Machine push endpoint for OHDSI DataQualityDashboard (DQD) results — P2 of
// docs/dqd-integration.md §4. Authenticated by a site-scoped API key (never a
// session/CSRF), not by the logged-in user.
//
//   POST /api/sites/{siteSlug}/datasets/{datasetSlug}/releases/{label}/dqd
//   Authorization: Bearer enk_live_...
//   Content-Type: application/json | application/gzip
//   Body: <the DQD results JSON, optionally gzip-compressed>
//
// Default behavior is replace-latest-with-history: a new push supersedes the
// current DqdResult row for the release; pass `?replace=false` to instead get a
// 409 when a current result already exists.

import { gunzipSync, gzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";
import { prefixFromSecret, verifyApiKey } from "@/lib/apikey";
import {
  DqdValidationError,
  MAX_DECOMPRESSED_BYTES,
  parseDqdPayload,
  summarizeDqdPayload,
  warnOnMetadataMismatch,
} from "@/lib/dqd";

function json(status: number, body: unknown) {
  return Response.json(body, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteSlug: string; datasetSlug: string; label: string }> },
) {
  const { siteSlug, datasetSlug, label } = await params;

  // ── Authenticate ────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const secret = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];
  if (!secret) return json(401, { error: "missing bearer token" });

  const prefix = prefixFromSecret(secret);
  if (!prefix) return json(401, { error: "malformed token" });

  const key = await prisma.apiKey.findUnique({ where: { prefix } });
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
    return json(401, { error: "invalid or revoked key" });
  }
  if (!verifyApiKey(secret, key.hashedKey)) {
    return json(401, { error: "invalid key" });
  }
  if (!key.scopes.includes("dqd:write")) {
    return json(403, { error: "key lacks dqd:write scope" });
  }

  // ── Authorize (key's site must own the dataset/release; no auto-create) ──
  const site = await prisma.site.findUnique({ where: { slug: siteSlug }, select: { id: true } });
  // 404s (not 403) throughout this block: a key must not be able to distinguish
  // "wrong site" from "site doesn't exist" for slugs it isn't scoped to.
  if (!site || site.id !== key.siteId) return json(404, { error: "release not found" });

  const dataset = await prisma.dataset.findUnique({
    where: { siteId_slug: { siteId: site.id, slug: datasetSlug } },
    select: { id: true },
  });
  if (!dataset) return json(404, { error: "release not found" });

  const release = await prisma.datasetRelease.findUnique({
    where: { datasetId_label: { datasetId: dataset.id, label } },
    select: { id: true, cdmVersion: true, vocabularyVersion: true },
  });
  if (!release) return json(404, { error: "release not found" });

  // ── Validate ──────────────────────────────────────────────────────────
  const bodyBuffer = Buffer.from(await request.arrayBuffer());
  if (bodyBuffer.byteLength > MAX_DECOMPRESSED_BYTES) {
    return json(413, { error: "payload too large" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let raw: string;
  if (contentType.includes("gzip")) {
    let decompressed: Buffer;
    try {
      decompressed = gunzipSync(bodyBuffer);
    } catch {
      return json(400, { error: "invalid gzip body" });
    }
    if (decompressed.byteLength > MAX_DECOMPRESSED_BYTES) {
      return json(413, { error: "decompressed payload too large" });
    }
    raw = decompressed.toString("utf8");
  } else {
    raw = bodyBuffer.toString("utf8");
  }

  let payload;
  try {
    payload = parseDqdPayload(raw);
  } catch (e) {
    if (e instanceof DqdValidationError) return json(400, { error: e.message });
    throw e;
  }

  const summary = summarizeDqdPayload(payload);
  const warnings = warnOnMetadataMismatch(payload.Metadata[0], release);

  // ── Store (replace-latest, keep history) ─────────────────────────────────
  const url = new URL(request.url);
  const disallowReplace = url.searchParams.get("replace") === "false";
  const compressed = gzipSync(Buffer.from(raw, "utf8"));

  const outcome = await prisma.$transaction(async (tx) => {
    const current = await tx.dqdResult.findFirst({
      where: { releaseId: release.id, supersededAt: null },
      select: { id: true },
    });
    if (current && disallowReplace) return { conflict: true as const };

    if (current) {
      await tx.dqdResult.update({ where: { id: current.id }, data: { supersededAt: new Date() } });
    }
    const created = await tx.dqdResult.create({
      data: {
        releaseId: release.id,
        uploadedByKeyId: key.id,
        dqdVersion: summary.dqdVersion,
        cdmVersion: summary.cdmVersion,
        vocabularyVersion: summary.vocabularyVersion,
        executionDate: summary.executionDate,
        countTotal: summary.countTotal,
        countPassed: summary.countPassed,
        countFailed: summary.countFailed,
        countError: summary.countError,
        countNotApplicable: summary.countNotApplicable,
        pctPassed: summary.pctPassed,
        breakdown: summary.breakdown,
        warnings: warnings.length > 0 ? warnings : undefined,
        payload: compressed,
        payloadBytes: compressed.byteLength,
      },
    });
    return { conflict: false as const, created };
  });

  if (outcome.conflict) {
    return json(409, { error: "a current DQD result already exists for this release" });
  }

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });

  return json(201, {
    resultId: outcome.created.id,
    summary: { ...summary, executionDate: summary.executionDate?.toISOString() ?? null },
    warnings,
  });
}
