// Shared field set for the study create + edit forms. Renders the inputs only;
// the caller wraps it in a <form action={…}> with its own submit button.

import { getTranslations } from "next-intl/server";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  CheckboxGroup,
} from "@/app/_components/form";
import {
  STUDY_TYPE,
  STUDY_DESIGN_TYPE,
  STUDY_SCOPE,
  STUDY_STATUS,
  VISIBILITY,
} from "@/lib/labels";

export interface StudyDefaults {
  title?: string;
  acronym?: string | null;
  studyType?: string;
  designType?: string | null;
  scope?: string[];
  description?: string | null;
  objective?: string | null;
  conditions?: string[];
  keywords?: string[];
  designRef?: string | null;
  status?: string;
  visibility?: string;
}

export async function StudyFields({ study }: { study?: StudyDefaults }) {
  const d = study ?? {};
  const t = await getTranslations("studies");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  const typeOpts = STUDY_TYPE.map((o) => ({ value: o.value, label: tl(`studyType.${o.value}`) }));
  const designOpts = STUDY_DESIGN_TYPE.map((o) => ({ value: o.value, label: tl(`studyDesignType.${o.value}`) }));
  const scopeOpts = STUDY_SCOPE.map((o) => ({ value: o.value, label: tl(`studyScope.${o.value}`) }));
  const statusOpts = STUDY_STATUS.map((o) => ({ value: o.value, label: tl(`studyStatus.${o.value}`) }));
  const visibilityOpts = VISIBILITY.map((o) => ({ value: o.value, label: tl(`visibility.${o.value}`) }));

  return (
    <>
      <Field label={t("field.title")}>
        <TextInput name="title" required defaultValue={d.title ?? ""} placeholder={t("ph.title")} />
      </Field>
      <Field label={t("field.acronym")}>
        <TextInput name="acronym" defaultValue={d.acronym ?? ""} placeholder={t("ph.acronym")} />
      </Field>
      <Field label={t("field.studyType")}>
        <Select name="studyType" options={typeOpts} defaultValue={d.studyType} required />
      </Field>
      <Field label={t("field.designType")}>
        <Select name="designType" options={designOpts} defaultValue={d.designType ?? ""} />
      </Field>
      <Field label={t("scope")} hint={t("hint.scope")}>
        <CheckboxGroup name="scope" options={scopeOpts} selected={d.scope} />
      </Field>
      <Field label={tc("description")}>
        <TextArea name="description" defaultValue={d.description ?? ""} placeholder={t("ph.description")} />
      </Field>
      <Field label={t("objective")}>
        <TextArea name="objective" defaultValue={d.objective ?? ""} placeholder={t("ph.objective")} />
      </Field>
      <Field label={t("conditions")} hint={t("hint.conditions")}>
        <TextInput name="conditions" defaultValue={(d.conditions ?? []).join(", ")} placeholder={t("ph.conditions")} />
      </Field>
      <Field label={t("keywords")} hint={t("hint.keywords")}>
        <TextInput name="keywords" defaultValue={(d.keywords ?? []).join(", ")} placeholder={t("ph.keywords")} />
      </Field>
      <Field label={t("designReference")} hint={t("hint.designRef")}>
        <TextInput name="designRef" type="url" defaultValue={d.designRef ?? ""} placeholder="https://github.com/ohdsi-studies/..." />
      </Field>
      <Field label={t("field.status")}>
        <Select name="status" options={statusOpts} defaultValue={d.status ?? "DRAFT"} required />
      </Field>
      <Field label={t("field.visibility")} hint={t("hint.visibility")}>
        <Select name="visibility" options={visibilityOpts} defaultValue={d.visibility ?? "PRIVATE"} required />
      </Field>
    </>
  );
}
