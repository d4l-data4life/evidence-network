import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { updateStudy } from "../../actions";
import { StudyFields } from "../../study-fields";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/form";

export default async function EditStudyPage({
  params,
  searchParams,
}: PageProps<"/studies/[slug]/edit">) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations("studies");

  const study = await prisma.study.findUnique({
    where: { slug },
    include: { members: { where: { userId: user.id }, select: { id: true } } },
  });
  if (!study) notFound();

  const canManage =
    study.ownerId === user.id || study.members.length > 0;
  if (!canManage) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={t("editTitle")}
        subtitle={t("editSubtitle")}
        back={{ href: `/studies/${study.slug}`, label: study.title }}
      />

      {sp.error === "missing" && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorMissing")}
        </p>
      )}

      <form action={updateStudy} className="flex flex-col gap-4">
        <input type="hidden" name="studyId" value={study.id} />
        <StudyFields
          study={{
            title: study.title,
            acronym: study.acronym,
            studyType: study.studyType,
            designType: study.designType,
            scope: study.scope,
            description: study.description,
            objective: study.objective,
            conditions: study.conditions,
            keywords: study.keywords,
            designRef: study.designRef,
            status: study.status,
            visibility: study.visibility,
          }}
        />
        <SubmitButton>{t("saveChanges")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
