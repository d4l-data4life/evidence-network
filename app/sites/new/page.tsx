import { getTranslations } from "next-intl/server";
import { createSite } from "../actions";
import { SiteFields } from "../site-fields";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/form";

export default async function NewSitePage({
  searchParams,
}: PageProps<"/sites/new">) {
  const params = await searchParams;
  const error = params.error === "missing";
  const t = await getTranslations("sites");

  return (
    <PageContainer>
      <PageHeader
        title={t("enrollTitle")}
        subtitle={t("enrollSubtitle")}
        back={{ href: "/sites", label: t("title") }}
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorMissing")}
        </p>
      )}

      <form action={createSite} className="flex flex-col gap-4">
        <SiteFields />
        <SubmitButton>{t("enrollSubmit")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
