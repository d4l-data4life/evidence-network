// Shared field set for the site create + edit forms.

import { getTranslations } from "next-intl/server";
import { Field, TextInput, TextArea, Select } from "@/app/_components/form";
import { SITE_ORG_TYPE } from "@/lib/labels";

export interface SiteDefaults {
  legalName?: string;
  abbreviation?: string | null;
  country?: string;
  orgType?: string;
  description?: string | null;
  website?: string | null;
  governancePolicy?: string | null;
}

export async function SiteFields({ site }: { site?: SiteDefaults }) {
  const d = site ?? {};
  const t = await getTranslations("sites");
  const tl = await getTranslations("labels");
  const orgOpts = SITE_ORG_TYPE.map((o) => ({
    value: o.value,
    label: tl(`siteOrgType.${o.value}`),
  }));
  return (
    <>
      <Field label={t("fields.legalName")}>
        <TextInput name="legalName" required defaultValue={d.legalName ?? ""} placeholder={t("fields.legalNamePlaceholder")} />
      </Field>
      <Field label={t("fields.abbreviation")}>
        <TextInput name="abbreviation" defaultValue={d.abbreviation ?? ""} placeholder={t("fields.abbreviationPlaceholder")} />
      </Field>
      <Field label={t("fields.country")} hint={t("fields.countryHint")}>
        <TextInput name="country" required defaultValue={d.country ?? ""} placeholder={t("fields.countryPlaceholder")} />
      </Field>
      <Field label={t("fields.orgType")}>
        <Select name="orgType" options={orgOpts} defaultValue={d.orgType} required />
      </Field>
      <Field label={t("fields.description")}>
        <TextArea name="description" defaultValue={d.description ?? ""} placeholder={t("fields.descriptionPlaceholder")} />
      </Field>
      <Field label={t("fields.website")}>
        <TextInput name="website" type="url" defaultValue={d.website ?? ""} placeholder={t("fields.websitePlaceholder")} />
      </Field>
      <Field label={t("fields.governanceContact")} hint={t("fields.governanceContactHint")}>
        <TextArea name="governancePolicy" defaultValue={d.governancePolicy ?? ""} placeholder={t("fields.governancePlaceholder")} />
      </Field>
    </>
  );
}
