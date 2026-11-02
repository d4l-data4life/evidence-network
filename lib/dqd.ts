// Validation + summarization for partner-supplied DQD (OHDSI DataQualityDashboard)
// results JSON. The payload is untrusted: every field is treated as data, never
// executed or trusted for structure beyond what's checked here. See
// docs/dqd-integration.md §1/§4.

/** Cap on decompressed JSON size accepted by the push endpoint (§4 step 3). */
export const MAX_DECOMPRESSED_BYTES = 25 * 1024 * 1024;

export class DqdValidationError extends Error {}

export interface DqdCheckResult {
  category?: string;
  checkLevel?: string;
  context?: string;
  passed?: boolean;
  failed?: boolean;
  isError?: boolean;
  notApplicable?: boolean;
  [key: string]: unknown;
}

export interface DqdMetadataRow {
  cdmSourceName?: string;
  cdmVersion?: string;
  vocabularyVersion?: string;
  dqdVersion?: string;
  [key: string]: unknown;
}

export interface DqdPayload {
  startTimestamp?: string;
  endTimestamp?: string;
  CheckResults: DqdCheckResult[];
  Metadata: DqdMetadataRow[];
  Overview?: unknown;
}

/** Parses raw JSON text and asserts the minimal DQD shape. Throws DqdValidationError. */
export function parseDqdPayload(raw: string): DqdPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DqdValidationError("body is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new DqdValidationError("body must be a JSON object");
  }
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.CheckResults)) {
    throw new DqdValidationError("missing CheckResults array");
  }
  if (!Array.isArray(p.Metadata)) {
    throw new DqdValidationError("missing Metadata array");
  }
  return p as unknown as DqdPayload;
}

type Tally = Record<string, { passed: number; failed: number }>;

function bump(bucket: Tally, key: string | undefined, status: RowStatus) {
  const k = key ?? "unknown";
  bucket[k] ??= { passed: 0, failed: 0 };
  if (status === "passed") bucket[k].passed++;
  else if (status === "failed") bucket[k].failed++;
}

type RowStatus = "passed" | "failed" | "error" | "notApplicable";

function rowStatus(r: DqdCheckResult): RowStatus {
  if (r.isError) return "error";
  if (r.notApplicable) return "notApplicable";
  if (r.failed) return "failed";
  return "passed";
}

export interface DqdSummary {
  dqdVersion: string | null;
  cdmVersion: string | null;
  vocabularyVersion: string | null;
  executionDate: Date | null;
  countTotal: number;
  countPassed: number;
  countFailed: number;
  countError: number;
  countNotApplicable: number;
  pctPassed: number;
  breakdown: { byCategory: Tally; byCheckLevel: Tally; byContext: Tally };
}

/** Computes the parsed-summary row (§5 DqdResult fields) from a validated payload. */
export function summarizeDqdPayload(payload: DqdPayload): DqdSummary {
  const meta = payload.Metadata[0];
  const byCategory: Tally = {};
  const byCheckLevel: Tally = {};
  const byContext: Tally = {};

  let countPassed = 0;
  let countFailed = 0;
  let countError = 0;
  let countNotApplicable = 0;

  for (const r of payload.CheckResults) {
    const status = rowStatus(r);
    if (status === "passed") countPassed++;
    else if (status === "failed") countFailed++;
    else if (status === "error") countError++;
    else countNotApplicable++;

    bump(byCategory, r.category, status);
    bump(byCheckLevel, r.checkLevel, status);
    bump(byContext, r.context, status);
  }

  const scored = countPassed + countFailed; // errors/N-A are excluded, matching DQD's own % pass

  return {
    dqdVersion: meta?.dqdVersion ?? null,
    cdmVersion: meta?.cdmVersion ?? null,
    vocabularyVersion: meta?.vocabularyVersion ?? null,
    executionDate: payload.startTimestamp ? new Date(payload.startTimestamp) : null,
    countTotal: payload.CheckResults.length,
    countPassed,
    countFailed,
    countError,
    countNotApplicable,
    pctPassed: scored > 0 ? countPassed / scored : 0,
    breakdown: { byCategory, byCheckLevel, byContext },
  };
}

/** Flags (non-blocking) a mismatch between the pushed Metadata and the declared release. */
export function warnOnMetadataMismatch(
  meta: DqdMetadataRow | undefined,
  release: { cdmVersion: string | null; vocabularyVersion: string | null },
): string[] {
  const warnings: string[] = [];
  if (!meta) return warnings;

  if (release.vocabularyVersion && meta.vocabularyVersion && meta.vocabularyVersion !== release.vocabularyVersion) {
    warnings.push(
      `vocabularyVersion mismatch: release declares "${release.vocabularyVersion}", push reports "${meta.vocabularyVersion}"`,
    );
  }

  // release.cdmVersion is the enum "V5_4"; DQD reports a free-form string like "5.4.0" —
  // compare only the digit sequence ("54" must prefix-match) to avoid false positives.
  if (release.cdmVersion && meta.cdmVersion) {
    const declared = release.cdmVersion.replace(/\D/g, "");
    const reported = meta.cdmVersion.replace(/\D/g, "");
    if (declared && reported && !reported.startsWith(declared)) {
      warnings.push(`cdmVersion mismatch: release declares "${release.cdmVersion}", push reports "${meta.cdmVersion}"`);
    }
  }

  return warnings;
}
