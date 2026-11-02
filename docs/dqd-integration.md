# Data Quality Dashboard (DQD) integration — proposal

> Status: **design proposal** (not implemented). Scope: ingest and display OHDSI
> [DataQualityDashboard](https://github.com/OHDSI/DataQualityDashboard) results.
> Achilles is a follow-up that reuses most of this machinery (see §12).

## 0. TL;DR / recommendation

A data partner runs DQD locally against one OMOP data cut, producing a results
**JSON**. They mint a **site-scoped API key** in the app and `POST` that JSON to
a machine endpoint that attaches it to a specific **`DatasetRelease`** (the data
cut). The app stores the raw JSON (gzipped) plus a parsed summary, and renders a
faithful DQD dashboard for anyone allowed to see that dataset.

Recommended defaults (all revisitable — see §11):

1. **Anchor DQD results to `DatasetRelease`**, not `DatasetVersion`. DQD measures
   *data*, and a release *is* one immutable OMOP data cut. (Your phrase "dataset
   version" maps to what we renamed to **Release**.)
2. **Site-scoped API keys** (`dqd:write`), created by a site owner/admin, usable
   for any dataset/release under that site.
3. **Store the full JSON as a gzipped blob + a parsed summary row.** Render the
   detail table client-side from the JSON (as DQD's own viewer does). Defer the
   per-check relational table to a later phase.
4. **Replace-latest with history**: a new push for a release becomes current; the
   previous one is retained (superseded), because a partner may re-run DQD (new
   DQD version, fixed ETL) against the same cut.
5. **DQD visibility follows the dataset**: owners/team always; others only when
   the dataset is `Authenticated` + `Approved`; coordinators while reviewing.

---

## 1. What DQD produces (the input we consume)

DQD (`executeDqChecks(..., writeToJson = TRUE)`) runs ~4,000 parameterised checks
against an OMOP CDM instance and writes one JSON file. Top-level shape:

```jsonc
{
  "startTimestamp": "...", "endTimestamp": "...", "executionTime": "123.4 secs",
  "Metadata":    [ { /* one row, ~= the OMOP CDM_SOURCE table */ } ],
  "Overview":    { /* rollup counts */ },
  "CheckResults":[ { /* one row per executed check */ } ]
}
```

- **`Metadata`** carries `cdmSourceName`, `cdmSourceAbbreviation`, `cdmHolder`,
  `sourceDescription`, `sourceReleaseDate`, `cdmReleaseDate`, `cdmVersion`,
  `vocabularyVersion`, and `dqdVersion`. **These are exactly the fields we already
  store on `DatasetRelease`** — so we can *validate the push against the declared
  release* and warn on mismatch (e.g. wrong vocabulary version).
- **`CheckResults[]`** — each entry has (names representative, pin to the DQD
  version we target): `checkId`, `checkName`, `checkLevel` (`TABLE`|`FIELD`|
  `CONCEPT`), `checkDescription`, `category` (`Conformance`|`Completeness`|
  `Plausibility`), `subcategory`, `context` (`Verification`|`Validation`),
  `cdmTableName`, `cdmFieldName`, `thresholdValue`, `numViolatedRows`,
  `pctViolatedRows`, `numDenominatorRows`, `executionTime`, `queryText`, and the
  status flags `passed` / `failed` / `isError` / `notApplicable` (+
  `notApplicableReason`, `error`, failure message).
- **Row status** (how DQD colours a row) derives from the flags:
  `isError → Error (grey/orange)`, `notApplicable → Not Applicable (grey)`,
  `failed → Fail (red)`, else `Pass (green)`. A check "fails" when
  `pctViolatedRows > thresholdValue`.

**Size**: a full run is a few thousand rows; `queryText` (SQL) dominates size, so
files are typically **1–10 MB**. Plan for gzip + a size cap.

**Trust**: the JSON is **partner-supplied, untrusted input**. Every string
(`queryText`, `error`, `checkName`, `notApplicableReason`, …) is data — render as
text, never HTML; cap counts; validate structure. We never execute `queryText`.

---

## 2. Where it attaches in our model

```
Site ──< Dataset ──< DatasetRelease ──< DqdResult (current + history)
   └──< ApiKey (dqd:write)
```

- A **`DqdResult`** belongs to one `DatasetRelease`.
- **`ApiKey`** belongs to a `Site`; a push authenticates with a key and targets a
  release *under that site*.

---

## 3. API keys

**Issuance.** On the site page, a new **"API keys"** section (owner/admin only):
create a key with a human label → the plaintext secret is shown **exactly once**
(copy-to-clipboard, "you won't see this again"). List shows label, prefix,
created-by, created/last-used, expiry; each row has **Revoke**.

**Format.** `enk_live_<random>` where `<random>` is 32 bytes, base32/hex.
`enk_` = product prefix, `live` = environment. First ~12 chars (`enk_live_ab12`)
are the **public prefix** stored for lookup + display; the remainder is the
secret.

**Storage.** Store only `sha256(secret)` (high-entropy token → a fast hash is
appropriate; use constant-time compare). Never store or log the plaintext. Fields:
`prefix` (unique, indexed), `hashedKey`, `siteId`, `name`, `scopes`, `createdById`,
`createdAt`, `lastUsedAt`, `expiresAt?`, `revokedAt?`.

**Scope.** `["dqd:write"]` for now; the array lets us add `achilles:write` later
without new tables. Recommended scope granularity = **site**; optional tighter
`datasetId` binding is a later toggle.

**Lifecycle.** Revocable, optional expiry, `lastUsedAt` tracked, and every push is
recorded in an audit log (§8).

---

## 4. The push API

```
POST /api/sites/{siteSlug}/datasets/{datasetSlug}/releases/{label}/dqd
Authorization: Bearer enk_live_...
Content-Type: application/json         # or application/gzip for the gzipped file
Body: <the DQD results JSON>
```

**Pipeline**
1. **Authenticate** — parse key → look up by prefix → constant-time compare hash →
   reject if revoked/expired. Update `lastUsedAt`.
2. **Authorize** — key's `siteId` must own `{datasetSlug}`; `{label}` must be an
   existing release on it. (No auto-create — the release is the unit of record.)
3. **Validate** — enforce size cap (e.g. 25 MB decompressed), accept gzip,
   JSON-parse, assert DQD shape (`CheckResults`/`Metadata`/`Overview` present),
   sane counts. Cross-check `Metadata.cdmVersion` / `vocabularyVersion` against the
   release; mismatch → still accept but flag a warning in the response + UI.
4. **Summarise** — compute rollups (total/passed/failed/error/NA, % passed;
   breakdowns by category, check level, context) and pull provenance
   (`dqdVersion`, `cdmVersion`, `vocabularyVersion`, execution date).
5. **Store** — gzip the raw JSON into `DqdResult.payload`; write the summary;
   mark any previous current result `supersededAt = now()`.
6. **Respond** `201` with `{ resultId, summary, warnings }`.

**Status codes**: `400` invalid JSON/shape · `401` bad/expired key · `403` key not
authorized for this site/dataset · `404` release · `413` too large · `429` rate
limited · `201` created.

Idempotency: default **replace-latest, keep history**. `?replace=false` makes it a
`409` if a current result already exists.

---

## 5. Storage model (Prisma sketch)

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  siteId      String
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)
  name        String
  prefix      String    @unique          // "enk_live_ab12", shown in UI + used for lookup
  hashedKey   String                      // sha256(secret)
  scopes      String[]  @default(["dqd:write"])
  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revokedAt   DateTime?
  @@index([siteId])
}

model DqdResult {
  id                 String         @id @default(cuid())
  releaseId          String
  release            DatasetRelease @relation(fields: [releaseId], references: [id], onDelete: Cascade)

  uploadedAt         DateTime       @default(now())
  uploadedByKeyId    String?                          // provenance (nullable if ever pushed via UI)
  supersededAt       DateTime?                        // null = current result for the release

  // parsed summary — cheap to read for lists/badges/matching
  dqdVersion         String?
  cdmVersion         String?
  vocabularyVersion  String?
  executionDate      DateTime?
  countTotal         Int
  countPassed        Int
  countFailed        Int
  countError         Int
  countNotApplicable Int
  pctPassed          Float
  breakdown          Json           // { byCategory, byCheckLevel, byContext }
  warnings           Json?          // e.g. metadata mismatch vs the release

  // full payload for the detailed viewer
  payload            Bytes          // gzipped DQD JSON
  payloadBytes       Int
  @@index([releaseId, supersededAt])
}
```

Add `apiKeys ApiKey[]` to `Site`, `dqdResults DqdResult[]` to `DatasetRelease`,
`apiKeys ApiKey[]` (created) to `User`.

*Optional later:* a `DqdCheckResult` child table (one row per check) if we want
server-side filtering/sorting or cross-dataset quality queries. ~4k rows/release
is fine in Postgres but unnecessary for v1, where the viewer reads the blob.

---

## 6. Display — recreate the DQD dashboard

Route: `/datasets/{siteSlug}/{datasetSlug}/releases/{label}/dqd` (guarded exactly
like the dataset detail page). On the dataset detail page, each **release card**
gains a quality badge, e.g. **"DQD 96.4% · 3,912/4,057"**, linking here; releases
with no result show **"No DQD results"**.

The view mirrors DQD's own viewer:

- **Header/provenance**: source name, CDM version, vocabulary version, DQD
  version, execution date, and any validation warnings.
- **Overview panel**: KPIs (Total, Pass, Fail, Error, Not Applicable, % Pass) and
  three breakdown grids — by **Category** (Conformance/Completeness/Plausibility),
  by **Check level** (Table/Field/Concept), by **Context**
  (Verification/Validation) — each showing pass/fail counts (the classic DQD
  matrix).
- **Results table**: one row per check with Status (colour dot), CDM table, CDM
  field, check name, level, category, subcategory, % records (`pctViolatedRows`),
  violated/denominator, threshold, notes. **Filters** by status, category, level,
  context, and CDM table; text search; sort. Row expands to show
  `checkDescription`, the failure message, and `queryText` in a `<pre>` block.
- **Scale**: paginate or virtualise the table (thousands of rows); render SQL as
  escaped text.

Implementation note: we render from our stored JSON with our own components
(faithful to DQD's layout + colour semantics). We do **not** need to run any check
logic — DQD already did. (DQD's own viewer is a Shiny/R app, so we reimplement the
presentation, not embed it.)

---

## 7. Partner workflow

After a normal DQD run:

```r
DataQualityDashboard::executeDqChecks(
  connectionDetails = cd, cdmDatabaseSchema = "cdm",
  resultsDatabaseSchema = "results", cdmSourceName = "IPCI",
  outputFolder = "dqd_out", writeToJson = TRUE, writeToTable = FALSE
)
# -> dqd_out/results_IPCI.json
```

Push it (their machine, behind their firewall — only the results leave):

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ENK_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @dqd_out/results_IPCI.json \
  https://<host>/api/sites/demo-data-partner/datasets/demo-ipci/releases/2024-Q1/dqd
```

We can ship a tiny helper (bash/R one-liner in the site's API-keys UI, prefilled
with the correct URL for each release) so partners copy-paste.

---

## 8. Security & abuse considerations

- **Keys**: hashed at rest, shown once, revocable, optional expiry, constant-time
  compare, per-key rate limit (e.g. 10 pushes/min), `lastUsedAt`.
- **Machine endpoint**: no session/CSRF; auth is the key only. Enforce
  `Content-Length`/size cap, gzip bomb guard (cap *decompressed* size), strict
  content-type, and JSON-shape validation before doing any work.
- **Untrusted payload**: treat every field as data; escape on render; cap the
  number of `CheckResults` stored/rendered; never eval `queryText`.
- **Authorization**: a key can only write to releases under its own site; deny
  cross-site pushes even if slugs are guessed.
- **Audit**: append-only log of push attempts (key prefix, site, dataset, release,
  bytes, result, ip, ua) for the site owner + superusers.
- **Privacy**: DQD results are aggregate counts (no patient rows) — consistent
  with the "metadata + aggregate only, never patient data" principle. Still gate
  display behind the dataset's visibility/approval.

---

## 9. How it touches existing pieces

- **Schema**: `+ApiKey`, `+DqdResult` (migration; additive).
- **Sites**: new "API keys" section on `/sites/{slug}` (owner/admin).
- **Datasets**: release cards show a DQD badge; new DQD view route.
- **i18n**: add a `dqd` message namespace (en/pt-BR/es) — check *category*,
  *level*, *context*, and status names are a small controlled vocabulary; the
  per-check `checkName`/`description` come from DQD and stay in English (they are
  DQD identifiers, not our copy).
- **Matching (later)**: `DqdResult.pctPassed` / completeness can become a quality
  signal in study↔dataset matching.

---

## 10. Rollout phases

1. **P1 — Keys**: `ApiKey` model + site "API keys" UI (create/reveal-once/revoke)
   + audit log.
2. **P2 — Ingest**: the push endpoint, validation, gzip storage + summary.
3. **P3 — View**: the DQD dashboard page + release badge (+ i18n).
4. **P4 — Later**: Achilles, `DqdCheckResult` relational table for cross-dataset
   quality queries, quality signals into matching.

---

## 11. Decisions

**Locked (2026-09-08):**
1. ✅ **Anchor = `DatasetRelease`** — DQD attaches to the immutable OMOP data cut.
2. ✅ **API-key scope = site** — one key pushes for any dataset/release under it.
3. ✅ **Storage = gzipped blob + parsed summary** — viewer renders checks
   client-side; per-check relational table deferred to P4.

**Assumed defaults (flag if you disagree):**
4. **Overwrite policy = replace-latest + keep history** (a re-run supersedes the
   current result; prior results retained).
5. **DQD visibility = follows the dataset** (owners/team always; others when
   `Authenticated` + `Approved`; coordinators while reviewing).

---

## 12. Achilles (next) — how this generalises

Achilles produces characterisation output (historically `achilles_results` +
exported JSONs consumed by AchillesWeb / ATLAS "Data Sources"). The **same
`ApiKey`** (add scope `achilles:write`) and the **same per-release ingest pattern**
apply; storage would be an analogous `AchillesResult` (blob + summary), and the
viewer would render the record/domain drill-downs Achilles is known for. Designing
DQD ingest generically (keys with scopes, per-release results, blob+summary) keeps
Achilles a small increment rather than a second system.
