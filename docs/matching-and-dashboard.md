# Study ↔ Dataset matching + home dashboard (proposal)

> Status: **Tier-1 matcher + dashboard IMPLEMENTED (2026-08-14).** The
> metadata-only matcher (`lib/matching/`), `Match`/`MatchRun` models (migration
> `matching_engine`), the on-demand "Run matching now" button, and the redesigned
> home dashboard are live. The overnight/scheduled job and Tier-2/3
> (Achilles/DQD/concept-set feasibility) remain designed-but-not-built. Grounded
> in how OHDSI/EHDEN assess "study/database feasibility"; sources at the end.

## 1. The core idea — matching *is* feasibility assessment, in two layers

OHDSI has no single "feasibility score." Fit is judged in two layers, and they
map directly onto our phased data model:

| Layer | Question | Data needed | Our phase |
|---|---|---|---|
| **1 · Discovery (coarse)** | Does this dataset *plausibly* belong in the candidate set? | Catalogue metadata only (source type, therapeutic area, country, CDM version, population size) | **Available now** (Study A + Dataset D1) |
| **2 · Feasibility (characterization)** | Do the study's *specific* concepts exist, in enough people, with enough follow-up and quality? | Achilles counts + DQD (aggregate, federated-safe) | Needs Dataset **D2/D3** |
| **3 · Diagnostics (per-DB compute)** | CohortDiagnostics-grade: concept coverage, incidence plausibility, comparator/PS overlap, MDRR power | Study's structured concept sets executed per DB | Needs Study **Layer C** + execution (Layer D) |

**Implication:** we can ship a genuinely useful *discovery* matcher today on coarse
metadata, and make it progressively precise as datasets gain Achilles/DQD and
studies gain structured cohorts — without re-architecting. This is exactly the
EHDEN/EMA pattern (catalogue facets → Achilles dashboards).

## 2. Matching signals (ranked, with data tier)

Hard filters exclude; soft signals rank the survivors. Tier = what data each needs
(A = coarse metadata / now, B = Achilles, C = concept sets, D = DQD/phenotype).

**Hard filters (binary gate):**
| Signal | Tier |
|---|---|
| Dataset has a published `DatasetVersion` (i.e. a usable CDM) | A |
| CDM / vocabulary version compatible with study requirement (if declared) | A/B |
| Requester is permitted to see the counterpart (visibility / ownership) | A |
| Required domains captured (study needs measurements → DB populates them) | B |
| Exposure & outcome concept sets populated ≥ min persons | B+C |
| Comparator cohort available (population-level estimation only) | B+C |
| Minimum population size | A/B |
| DQD quality floor, if the study mandates one | D |

**Soft / weighted signals (rank):**
| Signal | Tier | Notes |
|---|---|---|
| Therapeutic-area / condition alignment | A | strongest cheap prior; token overlap of study conditions+keywords vs dataset therapeutic areas |
| Study-type ↔ source-type suitability | A | small compatibility matrix (below) |
| Design → follow-up fit | A/B | longitudinal sources (EHR/claims) favored for designs needing time-at-risk |
| Care-setting / coding-system relevance | A | weak prior |
| Country / geography | A | representativeness / regulatory scope |
| Magnitude of exposure/outcome person counts → power (MDRR) | B/C | strongest *feasibility* signal once characterization exists |
| Incidence-rate plausibility, concept coverage (orphan/index events) | C | CohortDiagnostics-grade |
| Coding density (concepts/person) | B | |
| Data-quality pass-rate gradient | D | continuous quality prior |
| Phenotype reliability (PheValuator/KEEPER) | D | rarely available up front |

### Study-design → data-requirement mapping (drives the hard filters automatically)
| Study type / design | Implied requirement |
|---|---|
| Characterization | lightest — entities present + some follow-up; most populated DBs qualify |
| Population-level estimation | **target + comparator** both sized, outcome counts for power, PS overlap → comparator availability is a *hard* extra filter |
| Patient-level prediction | long, dense, multi-domain follow-up per person |
| Cohort / new-user | adequate post-index observation time |
| Case-control | enough cases + controls |
| SCCS | within-person longitudinal exposure + outcome recurrence (single-arm; no comparator DB needed) |

**Recommendation:** add explicit study attributes `requiresComparator`,
`requiredFollowupDays`, `requiredDomains[]`, `minPopulation`, `requiredCdmVersion`
so hard filters are generated per study rather than hard-coded. (Phase-A can
default these from `studyType`/`designType`.)

## 3. What we can compute **today** (Tier-1, coarse metadata)

With current fields — study `{studyType, designType, scope, conditions, keywords}`
and dataset `{sourceType, careSetting, therapeuticAreas, sourceCodingSystems}` +
`DatasetVersion {cdmVersion, vocabularyVersion, status}` — a concrete scorer:

1. **Hard gate:** dataset has ≥1 `PUBLISHED` version; requester may see the
   counterpart; (if study declares `requiredCdmVersion`) a version matches.
2. **Weighted score (0–100)**, each sub-score 0..1 × weight:
   - `therapeuticOverlap` (w=50): normalized token overlap of
     `study.conditions ∪ study.keywords` vs `dataset.therapeuticAreas`.
   - `sourceTypeSuitability` (w=25): lookup in a `studyType × sourceType` matrix
     (e.g. PLE→{claims, EHR} high; drug-utilisation→{claims, pharmacy} high;
     characterization→broad; PLP→{EHR} high).
   - `designFollowupFit` (w=15): longitudinal source bonus when the design needs
     time-at-risk.
   - `careSetting/coding` (w=10): weak relevance.
   - `score = round(100 × Σ(subscore×weight) / Σ(applicable weights))`.
3. **Bands:** Strong ≥70 · Possible 40–69 · Weak <40 (hidden by default).
4. **Explainability (required):** store a rationale breakdown ("matched on
   therapeutic area *cardiology*; EHR source suitable for PLE; longitudinal
   follow-up available") so a score is never a black box.

> **Honest framing in the UI:** a Tier-1 match is a *discovery prior* — "worth a
> look" — **not** a feasibility guarantee. Real feasibility ("does this DB have
> ≥N people on the drug with the outcome") needs Achilles (Tier-2). The UI should
> label matches with their tier/confidence and never overstate a coarse match.

### Free-text caveat
`conditions` and `therapeuticAreas` are free text today, so overlap is fuzzy
(normalize case/stem; optional synonym list). Precise matching wants **coded**
terms — MedDRA/ATC on the study side, OMOP concepts on the dataset side — which is
the Tier-2/3 upgrade path. Track this as the main accuracy limiter of Tier-1.

## 4. Proposed data model additions

```
Match            one row per (study, dataset) candidate pair
  studyId, datasetId
  datasetVersionId?         // the version characterization used (Tier-2+)
  score        Int          // 0..100
  band         enum         // STRONG | POSSIBLE | WEAK
  tier         enum         // METADATA | CHARACTERIZATION | DIAGNOSTICS
  rationale    Json         // per-signal contributions + human strings
  computedAt   DateTime
  matchRunId?                // which run produced/updated it
  // triage is per-side (a match has two owners):
  studyOwnerState enum       // NEW | VIEWED | SAVED | DISMISSED
  siteOwnerState  enum       // NEW | VIEWED | SAVED | DISMISSED
  @@unique([studyId, datasetId])

MatchRun         provenance for on-demand + scheduled runs
  trigger      enum          // ON_DEMAND | SCHEDULED
  scope        enum          // SINGLE_STUDY | SINGLE_DATASET | DELTA | FULL
  targetId?                  // study or dataset id for single-scope
  triggeredById?             // User (null for scheduled)
  startedAt, finishedAt
  created, updated, evaluated  // counts

Notification     powers the overnight "you have new matches" feature
  userId, type   // NEW_STUDY_MATCHES | NEW_DATASET_MATCHES
  payload  Json  // e.g. {studyId, newMatchCount}
  createdAt, readAt?
```

Notes: match at the **dataset** grain for Tier-1 (metadata is version-independent);
record `datasetVersionId` once a characterization tier evaluates a specific cut.
Per-side triage states let a study owner dismiss a match without affecting the
site owner's view.

## 5. On-demand + overnight architecture

Keep one **pure matching core** invoked by both paths — no logic duplication:

```
lib/matching/
  signals.ts     // pure scorers (therapeuticOverlap, sourceTypeSuitability, …)
  compute.ts     // computeForStudy(studyId) / computeForDataset(datasetId)
                 //   → load candidates, apply hard filters, score, upsert Match rows
```

- **On-demand ("Run matching now" button):** a server action calls
  `computeForStudy`/`computeForDataset` synchronously (Tier-1 is cheap), records a
  `MatchRun{trigger: ON_DEMAND}`, revalidates the page. Instant feedback.
- **Overnight (scheduled):** a **delta run** — find studies/datasets with
  `updatedAt >` the last run's watermark (or `createdAt` since yesterday),
  recompute matches for them *and* their counterparts, and write `Notification`
  rows for affected owners ("3 new datasets match *DEMO-DPP4*"; "your *IPCI*
  dataset is now addressable by 2 studies"). Records `MatchRun{trigger: SCHEDULED,
  scope: DELTA}`.

**How to schedule it in this stack (pick one):**
| Option | Fit |
|---|---|
| A small `scheduler` service in docker-compose (node-cron) that calls the core via a script | simplest, self-contained — **recommended for now** |
| A secured internal route `POST /api/matching/run` (shared-secret) hit by system/cron | good if you already run cron |
| A job queue + worker (BullMQ/Redis) | production scale — overkill today |

Delta + idempotent upserts mean the overnight job is cheap and safe to re-run.
Notifications drive both an in-app feed and (later) email.

## 6. Home dashboard redesign

Today `/dashboard` shows session details. Replace it with an **operational home**
that answers "what do I have, and what matches it?" Session/account details move to
a small `/account` page (or a footer).

```
┌ Welcome, {name}                         [New study] [Enroll site] [Add dataset] ┐
│                                                                                  │
│  YOUR MATCHES                                              [Run matching now]    │
│  ┌ For your studies ─────────────┐   ┌ For your datasets ───────────────────┐  │
│  │ DEMO-DPP4                      │   │ IPCI (Demo Data Partner)             │  │
│  │  • Demo IPCI      Strong 82 ▸  │   │  • DEMO-DPP4         Strong 82 ▸      │  │
│  │  • ClaimsDB       Possible 54▸ │   │  • Char. study X     Possible 47 ▸   │  │
│  │  “matched on: type 2 diabetes; │   │  (2 new since yesterday)             │  │
│  │   EHR suitable for PLE”        │   │                                      │  │
│  └────────────────────────────────┘   └──────────────────────────────────────┘ │
│                                                                                  │
│  MY STUDIES (2)         MY SITES (1)              MY DATASETS (3)                 │
│  • DEMO-DPP4  …         • Demo Data Partner       • Demo IPCI  (1 version)        │
│  • …  → all studies      → all sites                • …  → all datasets           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Matches hero** (top): two columns — *datasets matching my studies* and
  *studies addressable by my datasets* — each grouped, showing score + band + a
  one-line rationale, with "new since last visit" badges (from `Notification`).
  A single **Run matching now** button triggers an on-demand recompute across the
  user's own entities.
- **Summary row:** counts + recent items for My studies / My sites / My datasets,
  each linking to its existing list page.
- Only shows matches the user is entitled to (their studies ↔ visible datasets,
  their datasets ↔ visible studies).
- Empty states guide first actions (create a study, enroll a site).

## 7. Recommended implementation slice
1. **Tier-1 matcher** (`lib/matching`, hard filters + weighted signals + rationale)
   + `Match` / `MatchRun` models. Metadata-only — works with today's data.
2. **On-demand button** wired to a server action.
3. **Dashboard redesign** consuming `Match` rows; move account details to `/account`.
4. **Overnight job** as a compose `scheduler` service doing a delta run +
   `Notification` rows; add a small in-app "new matches" indicator.

Defer Tier-2/3 (Achilles/concept-set feasibility) until Dataset D2/D3 and Study
Layer C land — the `tier`/`datasetVersionId`/`requiredDomains` fields above leave
the seam open.

## 8. Sources
- Book of OHDSI — Study Steps (feasibility/power), Characterization, Data Quality, Clinical Validity: https://ohdsi.github.io/TheBookOfOhdsi/
- CohortDiagnostics (per-DB cohort feasibility outputs): https://ohdsi.github.io/CohortDiagnostics/articles/WhatIsCohortDiagnostics.html
- Achilles analyses (per-concept person/record counts; analysis 5000 = CDM/vocab version): https://ohdsi.github.io/Achilles/ · analysis details CSV in the repo
- EHDEN CatalogueExport (curated Achilles subset; counts rounded to nearest 100): https://github.com/EHDEN/CatalogueExport
- HMA-EMA Catalogues of RWD sources (production coarse faceting): https://catalogues.ema.europa.eu/
- PheValuator (phenotype performance): https://ohdsi.github.io/PheValuator/
