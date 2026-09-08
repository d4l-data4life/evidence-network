import { getTranslations } from "next-intl/server";
import { requireSuperuser } from "@/lib/rbac";
import { getBranding, logoUrl } from "@/lib/settings";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { updateBranding } from "../actions";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { Field, TextInput, TextArea, Select, CheckboxGroup, SubmitButton } from "@/app/_components/form";

export default async function AdminBrandingPage() {
  await requireSuperuser();
  const branding = await getBranding();
  const t = await getTranslations("admin.branding");
  const tc = await getTranslations("common");

  const localeOptions = LOCALES.map((loc) => ({ value: loc, label: LOCALE_LABELS[loc] }));

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/dashboard", label: tc("home") }}
        action={
          <a href="/admin/users" className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-sm font-medium hover:border-foreground transition">
            {t("manageUsers")}
          </a>
        }
      />

      <form action={updateBranding} encType="multipart/form-data" className="flex flex-col gap-4">
        <Field label={t("appName")}>
          <TextInput name="appName" required defaultValue={branding.appName} />
        </Field>
        <Field label={t("tagline")} hint={t("taglineHint")}>
          <TextInput name="tagline" defaultValue={branding.tagline ?? ""} placeholder={t("taglinePlaceholder")} />
        </Field>
        <Field label={t("landingIntro")} hint={t("landingIntroHint")}>
          <TextArea name="landingIntro" defaultValue={branding.landingIntro} />
        </Field>
        <Field label={t("logoHeight")} hint={t("logoHeightHint")}>
          <TextInput name="logoHeight" type="number" min={16} max={240} defaultValue={String(branding.logoHeight)} />
        </Field>
        <Field label={t("accentColor")} hint={t("accentColorHint")}>
          <input
            type="color"
            name="accentColor"
            defaultValue={branding.accentColor}
            className="h-9 w-16 rounded border border-black/15 dark:border-white/20 bg-transparent"
          />
        </Field>
        <Field label={t("defaultLocale")} hint={t("defaultLocaleHint")}>
          <Select name="defaultLocale" required options={localeOptions} defaultValue={branding.defaultLocale} />
        </Field>
        <Field label={t("enabledLocales")} hint={t("enabledLocalesHint")}>
          <CheckboxGroup name="enabledLocales" options={localeOptions} selected={branding.enabledLocales} />
        </Field>
        <Field label={t("logo")} hint={t("logoHint")}>
          <input type="file" name="logo" accept="image/*" className="text-sm" />
        </Field>
        {branding.hasLogo && (
          <div className="flex items-center gap-2 text-sm text-black/50 dark:text-white/50">
            {t("currentLogo")}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl(branding)} alt="" className="h-8 w-auto" />
          </div>
        )}
        <SubmitButton>{t("save")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
