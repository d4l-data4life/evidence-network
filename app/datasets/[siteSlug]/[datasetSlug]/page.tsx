import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canReview } from "@/lib/rbac";
import { CDM_VERSION } from "@/lib/labels";
import {
  setDatasetVisibility,
  publishDatasetVersion,
  submitDatasetForApproval,
  withdrawDataset,
} from "@/app/sites/actions";
import { isPubliclyVisible } from "@/lib/visibility";
import {
  PageContainer,
  PageHeader,
  Card,
  Badge,
  EmptyState,
  LinkButton,
  ApprovalBadge,
} from "@/app/_components/ui";

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function DatasetDetailPage({
  params,
}: PageProps<"/datasets/[siteSlug]/[datasetSlug]">) {
  const user = await getCurrentUser();
  const { siteSlug, datasetSlug } = await params;
  const t = await getTranslations("datasets");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  const dataset = await prisma.dataset.findFirst({
    where: { slug: datasetSlug, site: { slug: siteSlug } },
    include: {
      site: {
        select: {
          legalName: true,
          slug: true,
          country: true,
          ownerId: true,
          members: { select: { userId: true } },
        },
      },
      releases: { orderBy: { createdAt: "desc" } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!dataset) notFound();

  const canManage =
    dataset.site.ownerId === user.id ||
    dataset.site.members.some((m) => m.userId === user.id);

  // Non-team users only see datasets that are AUTHENTICATED AND APPROVED —
  // except coordinators/superusers, who may view any record (e.g. to review it).
  if (!canManage && !isPubliclyVisible(dataset) && !canReview(user.systemRole)) {
    notFound();
  }

  const base = `/datasets/${dataset.site.slug}/${dataset.slug}`;
  const latestVersion = dataset.versions[0];
  const hasUnpublishedChanges =
    !latestVersion || dataset.updatedAt > latestVersion.createdAt;

  return (
    <PageContainer>
      <PageHeader
        title={dataset.name + (dataset.abbreviation ? ` (${dataset.abbreviation})` : "")}
        subtitle={`${tl(`datasetSourceType.${dataset.sourceType}`)} · ${dataset.site.legalName} · ${dataset.site.country}`}
        back={{ href: `/sites/${dataset.site.slug}`, label: dataset.site.legalName }}
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <Link
                href={`${base}/edit`}
                className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-sm font-medium hover:border-foreground transition"
              >
                {tc("edit")}
              </Link>
              <LinkButton href={`${base}/releases/new`}>{t("addRelease")}</LinkButton>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {dataset.visibility === "AUTHENTICATED" ? (
          <Badge tone="green">{tl("visibility.AUTHENTICATED")}</Badge>
        ) : (
          <Badge tone="amber">{tl("visibility.PRIVATE")}</Badge>
        )}
        <ApprovalBadge status={dataset.approvalStatus} />
        {canManage && (
          <form action={setDatasetVisibility}>
            <input type="hidden" name="datasetId" value={dataset.id} />
            <input
              type="hidden"
              name="visibility"
              value={dataset.visibility === "AUTHENTICATED" ? "PRIVATE" : "AUTHENTICATED"}
            />
            <button
              type="submit"
              className="rounded-full border border-black/15 dark:border-white/25 px-3 py-1 text-xs font-medium hover:border-foreground transition"
            >
              {dataset.visibility === "AUTHENTICATED" ? t("makePrivate") : t("makeVisible")}
            </button>
          </form>
        )}
      </div>

      {/* Publication / approval panel */}
      {canManage && (
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-black/60 dark:text-white/60">
              {isPubliclyVisible(dataset)
                ? t("pubPublished")
                : dataset.approvalStatus === "PENDING"
                  ? t("pubSubmitted")
                  : dataset.approvalStatus === "APPROVED"
                    ? t("pubApproved")
                    : t("pubNotPublished")}
            </span>
            {(dataset.approvalStatus === "DRAFT" || dataset.approvalStatus === "REJECTED") && (
              <form action={submitDatasetForApproval}>
                <input type="hidden" name="datasetId" value={dataset.id} />
                <button type="submit" className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-medium hover:opacity-90 transition">
                  {t("submitForPublication")}
                </button>
              </form>
            )}
            {dataset.approvalStatus === "PENDING" && (
              <form action={withdrawDataset}>
                <input type="hidden" name="datasetId" value={dataset.id} />
                <button type="submit" className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-xs font-medium hover:border-foreground transition">
                  {t("withdraw")}
                </button>
              </form>
            )}
          </div>
          {dataset.approvalStatus === "REJECTED" && dataset.reviewNote && (
            <p className="text-xs text-red-700 dark:text-red-300">{t("rejected", { note: dataset.reviewNote })}</p>
          )}
        </div>
      )}

      {dataset.description && <p className="text-sm">{dataset.description}</p>}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Detail label={t("fields.careSetting")}>
          {dataset.careSetting.length ? dataset.careSetting.map((c) => tl(`datasetCareSetting.${c}`)).join(", ") : tc("none")}
        </Detail>
        <Detail label={t("fields.therapeuticAreas")}>
          {dataset.therapeuticAreas.length ? dataset.therapeuticAreas.join(", ") : tc("none")}
        </Detail>
        <Detail label={t("fields.sourceCodingSystems")}>
          {dataset.sourceCodingSystems.length ? dataset.sourceCodingSystems.join(", ") : tc("none")}
        </Detail>
      </dl>

      {/* OMOP data cuts */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("releasesHeading")}
        </h2>
        <p className="text-xs text-black/45 dark:text-white/45">
          {t("releasesHelp")}
        </p>
        {dataset.releases.length === 0 ? (
          <EmptyState>
            {t("noReleases")}
            {canManage ? ` ${t("noReleasesHint")}` : ""}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {dataset.releases.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-black/45 dark:text-white/45">
                      {t("releaseMeta", {
                        cdm: r.cdmVersion
                          ? (CDM_VERSION.find((o) => o.value === r.cdmVersion)?.label ?? r.cdmVersion)
                          : tc("none"),
                        vocab: r.vocabularyVersion ?? tc("none"),
                        date: fmtDate(r.sourceReleaseDate),
                      })}
                    </div>
                  </div>
                  <Badge tone={r.status === "PUBLISHED" ? "green" : "neutral"}>
                    {tl(`datasetReleaseStatus.${r.status}`)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Immutable catalog-metadata snapshots */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("metadataVersionsHeading")}
          </h2>
          {canManage && (
            <form action={publishDatasetVersion}>
              <input type="hidden" name="datasetId" value={dataset.id} />
              <button
                type="submit"
                className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-medium hover:opacity-90 transition"
              >
                {t("publishVersion", { n: (latestVersion?.versionNumber ?? 0) + 1 })}
              </button>
            </form>
          )}
        </div>

        {canManage && hasUnpublishedChanges && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {latestVersion
              ? t("unpublishedChanges", { n: latestVersion.versionNumber })
              : t("noVersionsDraft")}
          </p>
        )}

        {dataset.versions.length === 0 ? (
          <EmptyState>{t("noMetadataVersions")}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {dataset.versions.map((v) => (
              <Card key={v.id} href={`${base}/versions/${v.versionNumber}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge tone="blue">v{v.versionNumber}</Badge>
                    <span className="text-black/60 dark:text-white/60">
                      {v.createdAt.toISOString().slice(0, 10)}
                      {v.createdBy?.name ? ` · ${v.createdBy.name}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {v.note ? v.note.slice(0, 60) : t("readonlySnapshotInline")}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-black/45 dark:text-white/45">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
