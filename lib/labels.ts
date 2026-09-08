// Human-readable labels + option lists for the Prisma enums used in forms.
// Kept as explicit ordered arrays so <select>s have a stable, sensible order.

// Enum tokens that should stay all-caps rather than being title-cased.
const ACRONYMS = new Set([
  "EHR", "DQD", "CDM", "OMOP", "PLE", "PLP", "SCCS", "ORCID", "ETL", "RWD",
]);

export function humanize(value: string): string {
  return value
    .split("_")
    .map((w) =>
      ACRONYMS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

type Opt = { value: string; label: string };
const opts = (values: readonly string[]): Opt[] =>
  values.map((v) => ({ value: v, label: humanize(v) }));

export const VISIBILITY = opts(["PRIVATE", "AUTHENTICATED"]);

export const STUDY_TYPE = opts([
  "CHARACTERIZATION",
  "POPULATION_LEVEL_ESTIMATION",
  "PATIENT_LEVEL_PREDICTION",
]);
export const STUDY_DESIGN_TYPE = opts([
  "COHORT",
  "CASE_CONTROL",
  "CASE_ONLY",
  "CROSS_SECTIONAL",
  "SELF_CONTROLLED",
  "OTHER",
]);
export const STUDY_SCOPE = opts([
  "SAFETY",
  "EFFECTIVENESS",
  "DRUG_UTILISATION",
  "DISEASE_EPIDEMIOLOGY",
  "METHOD_DEVELOPMENT",
  "OTHER",
]);
export const STUDY_STATUS = opts([
  "DRAFT",
  "PROPOSED",
  "RECRUITING",
  "DESIGN_FINALIZED",
  "EXECUTING",
  "RESULTS_AVAILABLE",
  "COMPLETE",
  "SUSPENDED",
]);

export const SITE_ORG_TYPE = opts([
  "ACADEMIC",
  "HOSPITAL",
  "REGISTRY_HOLDER",
  "GOVERNMENT",
  "INDUSTRY",
  "NON_PROFIT",
  "OTHER",
]);

export const DATASET_SOURCE_TYPE = opts([
  "EHR",
  "CLAIMS",
  "HOSPITAL",
  "REGISTRY",
  "OTHER",
]);
export const DATASET_CARE_SETTING = opts([
  "PRIMARY_CARE",
  "INPATIENT",
  "OUTPATIENT",
  "EMERGENCY",
  "OTHER",
]);
export const CDM_VERSION: Opt[] = [
  { value: "V5_3", label: "5.3" },
  { value: "V5_4", label: "5.4" },
];
export const DATASET_RELEASE_STATUS = opts(["DRAFT", "PUBLISHED", "ARCHIVED"]);
