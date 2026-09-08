// Tier-1 (metadata) matching signals — PURE functions, no DB access.
//
// A "match" between a study and a dataset is a coarse *discovery prior* computed
// from catalogue metadata: it says "worth a look", NOT "feasible". Real
// feasibility needs Achilles/DQD (Tier-2+). See docs/matching-and-dashboard.md.
//
// Study data requirements are DERIVED from studyType/designType (no extra form
// fields) per the design decision.

export type Band = "STRONG" | "POSSIBLE" | "WEAK";

export interface StudyInput {
  studyType: string;
  designType: string | null;
  conditions: string[];
  keywords: string[];
}

export interface DatasetInput {
  sourceType: string;
  careSetting: string[];
  therapeuticAreas: string[];
  sourceCodingSystems: string[];
}

export interface SignalContribution {
  key: string;
  label: string;
  score: number; // 0..1
  weight: number; // relative weight
  detail: string;
}

export interface ScoreResult {
  score: number; // 0..100
  band: Band;
  signals: SignalContribution[];
  matchedTerms: string[];
  notes: string[];
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "study", "disease", "disorder", "data",
  "care", "health", "patients", "patient", "use", "using", "type",
]);

function tokens(values: string[]): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    for (const w of v.toLowerCase().split(/[^a-z0-9]+/)) {
      // crude singularization so "diabetes"/"diabetic" etc. stay distinct but
      // plurals collapse: drop a trailing "s" on words >4 chars.
      const t = w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;
      if (t.length >= 3 && !STOPWORDS.has(t)) out.add(t);
    }
  }
  return out;
}

// studyType × sourceType suitability (0..1).
const SOURCE_SUITABILITY: Record<string, Record<string, number>> = {
  CHARACTERIZATION: { EHR: 1, CLAIMS: 1, HOSPITAL: 0.8, REGISTRY: 0.8, OTHER: 0.6 },
  POPULATION_LEVEL_ESTIMATION: { CLAIMS: 1, EHR: 0.9, HOSPITAL: 0.6, REGISTRY: 0.6, OTHER: 0.4 },
  PATIENT_LEVEL_PREDICTION: { EHR: 1, CLAIMS: 0.7, HOSPITAL: 0.6, REGISTRY: 0.5, OTHER: 0.4 },
};

function therapeuticOverlap(study: StudyInput, dataset: DatasetInput) {
  const s = tokens([...study.conditions, ...study.keywords]);
  const d = tokens(dataset.therapeuticAreas);
  if (s.size === 0 || d.size === 0) {
    return { score: 0.4, matched: [] as string[], unknown: true };
  }
  const matched = [...s].filter((t) => d.has(t));
  return { score: Math.min(1, matched.length / s.size), matched, unknown: false };
}

function designNeedsFollowup(study: StudyInput): boolean {
  return (
    study.studyType === "PATIENT_LEVEL_PREDICTION" ||
    study.designType === "COHORT" ||
    study.designType === "SELF_CONTROLLED"
  );
}

function followupFit(study: StudyInput, dataset: DatasetInput): number {
  if (!designNeedsFollowup(study)) return 0.7; // follow-up not critical
  const longitudinal = dataset.sourceType === "EHR" || dataset.sourceType === "CLAIMS";
  if (longitudinal) return 1;
  if (dataset.sourceType === "REGISTRY") return 0.7;
  if (dataset.sourceType === "HOSPITAL") return 0.5;
  return 0.4;
}

function metadataCompleteness(dataset: DatasetInput): number {
  let c = 0;
  if (dataset.careSetting.length) c += 0.5;
  if (dataset.sourceCodingSystems.length) c += 0.5;
  return c || 0.3;
}

function bandFor(score: number): Band {
  if (score >= 70) return "STRONG";
  if (score >= 40) return "POSSIBLE";
  return "WEAK";
}

/** Score a single (study, dataset) pair on Tier-1 metadata signals. */
export function scorePair(study: StudyInput, dataset: DatasetInput): ScoreResult {
  const ther = therapeuticOverlap(study, dataset);
  const src =
    SOURCE_SUITABILITY[study.studyType]?.[dataset.sourceType] ?? 0.5;
  const fu = followupFit(study, dataset);
  const complete = metadataCompleteness(dataset);

  const signals: SignalContribution[] = [
    {
      key: "therapeutic",
      label: "Therapeutic / condition alignment",
      score: ther.score,
      weight: 50,
      detail: ther.unknown
        ? "study lists no conditions/keywords, or dataset no therapeutic areas"
        : ther.matched.length
          ? `overlap on: ${ther.matched.join(", ")}`
          : "no shared therapeutic terms",
    },
    {
      key: "sourceType",
      label: "Study-type ↔ source-type suitability",
      score: src,
      weight: 25,
      detail: `${labelEnum(dataset.sourceType)} source for ${labelEnum(study.studyType)}`,
    },
    {
      key: "followup",
      label: "Design ↔ follow-up fit",
      score: fu,
      weight: 15,
      detail: designNeedsFollowup(study)
        ? `${labelEnum(dataset.sourceType)} follow-up suitability`
        : "follow-up not critical for this design",
    },
    {
      key: "completeness",
      label: "Metadata completeness",
      score: complete,
      weight: 10,
      detail: "care-setting / coding-system detail provided",
    },
  ];

  const totalWeight = signals.reduce((a, s) => a + s.weight, 0);
  const score = Math.round(
    (100 * signals.reduce((a, s) => a + s.score * s.weight, 0)) / totalWeight,
  );

  const notes: string[] = [
    "Tier-1 metadata match: a discovery prior, not a feasibility guarantee. " +
      "Confirming feasibility needs Achilles characterization (record/person counts).",
  ];
  if (study.studyType === "POPULATION_LEVEL_ESTIMATION") {
    notes.push(
      "Population-level estimation needs a comparator cohort — availability cannot be confirmed from metadata alone.",
    );
  }
  if (ther.unknown) {
    notes.push(
      "Topical fit is uncertain: add conditions/keywords to the study and therapeutic areas to the dataset to improve matching.",
    );
  }

  return { score, band: bandFor(score), signals, matchedTerms: ther.matched, notes };
}

const ACRONYMS = new Set(["EHR", "DQD", "CDM", "OMOP", "PLE", "PLP", "SCCS"]);

function labelEnum(v: string): string {
  return v
    .split("_")
    .map((w) =>
      ACRONYMS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

/** One-line human summary of a score result, for cards. */
export function rationaleSummary(res: ScoreResult): string {
  if (res.matchedTerms.length) {
    return `Matched on ${res.matchedTerms.slice(0, 3).join(", ")}` +
      `; ${res.signals[1].detail.toLowerCase()}.`;
  }
  return `${res.signals[1].detail}; ${res.signals[2].detail.toLowerCase()}.`;
}
