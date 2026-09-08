import { getTranslations } from "next-intl/server";
import { createStudy } from "../actions";
import { StudyFields } from "../study-fields";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/form";

export default async function NewStudyPage({
  searchParams,
}: PageProps<"/studies/new">) {
  const params = await searchParams;
  const error = params.error === "missing";
  const t = await getTranslations("studies");

  return (
    <PageContainer>
      <PageHeader
        title={t("new")}
        subtitle={t("newSubtitle")}
        back={{ href: "/studies", label: t("title") }}
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorMissing")}
        </p>
      )}

      <form action={createStudy} className="flex flex-col gap-4">
        <StudyFields />
        <SubmitButton>{t("createStudy")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
