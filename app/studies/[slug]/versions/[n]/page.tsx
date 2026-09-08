import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isPubliclyVisible } from "@/lib/visibility";
import { PageContainer, PageHeader, Badge } from "@/app/_components/ui";

// Read-only view of an immutable published snapshot.
export default async function StudyVersionPage({
  params,
}: PageProps<"/studies/[slug]/versions/[n]">) {
  const user = await requireUser();
  const { slug, n } = await params;
  const t = await getTranslations("studies");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");
  const versionNumber = Number.parseInt(n, 10);
  if (!Number.isInteger(versionNumber)) notFound();

  const study = await prisma.study.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      visibility: true,
      approvalStatus: true,
      ownerId: true,
      members: { select: { userId: true } },
    },
  });
  if (!study) notFound();

  const isMember =
    study.ownerId === user.id || study.members.some((m) => m.userId === user.id);
  if (!isMember && !isPubliclyVisible(study)) notFound();

  const v = await prisma.studyVersion.findUnique({
    where: { studyId_versionNumber: { studyId: study.id, versionNumber } },
    include: { createdBy: { select: { name: true, orcidId: true } } },
  });
  if (!v) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={`${v.title}${v.acronym ? ` (${v.acronym})` : ""}`}
        subtitle={v.objective ?? undefined}
        back={{ href: `/studies/${study.slug}`, label: t("currentStudy") }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue">{t("version", { n: v.versionNumber })}</Badge>
        <Badge>{t("snapshotBadge")}</Badge>
        <Badge>{tl(`studyStatus.${v.status}`)}</Badge>
        <Badge>{tl(`studyType.${v.studyType}`)}</Badge>
        {v.designType && <Badge>{tl(`studyDesignType.${v.designType}`)}</Badge>}
      </div>

      <p className="text-xs text-black/45 dark:text-white/45">
        {v.createdBy?.name
          ? t("frozenByOn", {
              date: v.createdAt.toISOString().slice(0, 10),
              name: v.createdBy.name,
            })
          : t("frozenOn", { date: v.createdAt.toISOString().slice(0, 10) })}{" "}
        {t("snapshotImmutable")}
      </p>
      {v.note && (
        <p className="text-sm rounded-md border border-black/10 dark:border-white/15 px-3 py-2">
          <span className="text-black/45 dark:text-white/45">{t("note")}: </span>
          {v.note}
        </p>
      )}

      {v.description && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {tc("description")}
          </h2>
          <p className="text-sm">{v.description}</p>
        </section>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Detail label={t("scope")}>{v.scope.length ? v.scope.map((s) => tl(`studyScope.${s}`)).join(", ") : tc("none")}</Detail>
        <Detail label={t("conditions")}>{v.conditions.length ? v.conditions.join(", ") : tc("none")}</Detail>
        <Detail label={t("keywords")}>{v.keywords.length ? v.keywords.join(", ") : tc("none")}</Detail>
        <Detail label={t("designReference")}>
          {v.designRef ? (
            <a href={v.designRef} target="_blank" rel="noopener noreferrer" className="text-[#5a7300] dark:text-[#A6CE39] hover:underline break-all">
              {v.designRef}
            </a>
          ) : tc("none")}
        </Detail>
      </dl>
    </PageContainer>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-black/45 dark:text-white/45">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
