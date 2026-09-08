// Shared field set for the dataset create + edit forms (catalog metadata).

import { getTranslations } from "next-intl/server";
import { Field, TextInput, TextArea, Select, CheckboxGroup } from "@/app/_components/form";
import { DATASET_SOURCE_TYPE, DATASET_CARE_SETTING, VISIBILITY } from "@/lib/labels";

export interface DatasetDefaults {
  name?: string;
  abbreviation?: string | null;
  sourceType?: string;
  careSetting?: string[];
  therapeuticAreas?: string[];
  sourceCodingSystems?: string[];
  description?: string | null;
  visibility?: string;
}

export async function DatasetFields({ dataset }: { dataset?: DatasetDefaults }) {
  const d = dataset ?? {};
  const t = await getTranslations("datasets.fields");
  const tl = await getTranslations("labels");

  const sourceOpts = DATASET_SOURCE_TYPE.map((o) => ({ value: o.value, label: tl(`datasetSourceType.${o.value}`) }));
  const careOpts = DATASET_CARE_SETTING.map((o) => ({ value: o.value, label: tl(`datasetCareSetting.${o.value}`) }));
  const visOpts = VISIBILITY.map((o) => ({ value: o.value, label: tl(`visibility.${o.value}`) }));

  return (
    <>
      <Field label={t("name")}>
        <TextInput name="name" required defaultValue={d.name ?? ""} placeholder={t("namePlaceholder")} />
      </Field>
      <Field label={t("abbreviation")}>
        <TextInput name="abbreviation" defaultValue={d.abbreviation ?? ""} placeholder={t("abbreviationPlaceholder")} />
      </Field>
      <Field label={t("sourceType")}>
        <Select name="sourceType" options={sourceOpts} defaultValue={d.sourceType} required />
      </Field>
      <Field label={t("careSetting")} hint={t("careSettingHint")}>
        <CheckboxGroup name="careSetting" options={careOpts} selected={d.careSetting} />
      </Field>
      <Field label={t("therapeuticAreas")} hint={t("therapeuticAreasHint")}>
        <TextInput name="therapeuticAreas" defaultValue={(d.therapeuticAreas ?? []).join(", ")} placeholder={t("therapeuticAreasPlaceholder")} />
      </Field>
      <Field label={t("sourceCodingSystems")} hint={t("sourceCodingSystemsHint")}>
        <TextInput name="sourceCodingSystems" defaultValue={(d.sourceCodingSystems ?? []).join(", ")} placeholder={t("sourceCodingSystemsPlaceholder")} />
      </Field>
      <Field label={t("description")}>
        <TextArea name="description" defaultValue={d.description ?? ""} placeholder={t("descriptionPlaceholder")} />
      </Field>
      <Field label={t("visibility")} hint={t("visibilityHint")}>
        <Select name="visibility" options={visOpts} defaultValue={d.visibility ?? "PRIVATE"} required />
      </Field>
    </>
  );
}
