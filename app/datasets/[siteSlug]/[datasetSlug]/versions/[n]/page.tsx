import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canReview } from "@/lib/rbac";
import { isPubliclyVisible } from "@/lib/visibility";
import { PageContainer, PageHeader, Badge } from "@/app/_components/ui";

// Read-only view of an immutable Dataset catalog-metadata snapshot.
export default async function DatasetVersionPage({
  params,
}: PageProps<"/datasets/[siteSlug]/[datasetSlug]/versions/[n]">) {
  const user = await getCurrentUser();
  const t = await getTranslations("datasets");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");
  const { siteSlug, datasetSlug, n } = await params;
  const versionNumber = Number.parseInt(n, 10);
  if (!Number.isInteger(versionNumber)) notFound();

  const dataset = await prisma.dataset.findFirst({
    where: { slug: datasetSlug, site: { slug: siteSlug } },
    select: {
      id: true,
      slug: true,
      visibility: true,
      approvalStatus: true,
      site: {
        select: {
          legalName: true,
          slug: true,
          ownerId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!dataset) notFound();

  const canManage =
    dataset.site.ownerId === user.id ||
    dataset.site.members.some((m) => m.userId === user.id);
  if (!canManage && !isPubliclyVisible(dataset) && !canReview(user.systemRole)) {
    notFound();
  }

  const v = await prisma.datasetVersion.findUnique({
    where: { datasetId_versionNumber: { datasetId: dataset.id, versionNumber } },
    include: { createdBy: { select: { name: true } } },
  });
  if (!v) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={`${v.name}${v.abbreviation ? ` (${v.abbreviation})` : ""}`}
        subtitle={`${tl(`datasetSourceType.${v.sourceType}`)} · ${dataset.site.legalName}`}
        back={{ href: `/datasets/${dataset.site.slug}/${dataset.slug}`, label: t("currentDataset") }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue">{t("versionBadge", { n: v.versionNumber })}</Badge>
        <Badge>{t("readonlySnapshotBadge")}</Badge>
      </div>

      <p className="text-xs text-black/45 dark:text-white/45">
        {(v.createdBy?.name
          ? t("frozenBy", { date: v.createdAt.toISOString().slice(0, 10), name: v.createdBy.name })
          : t("frozen", { date: v.createdAt.toISOString().slice(0, 10) })) +
          " " +
          t("immutableSuffix")}
      </p>
      {v.note && (
        <p className="text-sm rounded-md border border-black/10 dark:border-white/15 px-3 py-2">
          <span className="text-black/45 dark:text-white/45">{t("noteLabel")} </span>
          {v.note}
        </p>
      )}

      {v.description && <p className="text-sm">{v.description}</p>}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Detail label={t("fields.careSetting")}>
          {v.careSetting.length ? v.careSetting.map((c) => tl(`datasetCareSetting.${c}`)).join(", ") : tc("none")}
        </Detail>
        <Detail label={t("fields.therapeuticAreas")}>
          {v.therapeuticAreas.length ? v.therapeuticAreas.join(", ") : tc("none")}
        </Detail>
        <Detail label={t("fields.sourceCodingSystems")}>
          {v.sourceCodingSystems.length ? v.sourceCodingSystems.join(", ") : tc("none")}
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
