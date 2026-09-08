import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publishSiteVersion } from "../actions";
import { isPubliclyVisible } from "@/lib/visibility";
import {
  PageContainer,
  PageHeader,
  Card,
  Badge,
  EmptyState,
  LinkButton,
} from "@/app/_components/ui";

export default async function SiteDetailPage({
  params,
}: PageProps<"/sites/[slug]">) {
  const user = await requireUser();
  const { slug } = await params;
  const t = await getTranslations("sites");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  const site = await prisma.site.findUnique({
    where: { slug },
    include: {
      owner: { select: { name: true, orcidId: true } },
      members: { select: { userId: true } },
      datasets: {
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { releases: true } } },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!site) notFound();

  const canManage =
    site.ownerId === user.id || site.members.some((m) => m.userId === user.id);
  const latestVersion = site.versions[0];
  const hasUnpublishedChanges =
    !latestVersion || site.updatedAt > latestVersion.createdAt;

  // Non-managers only see the site's publicly-visible (authenticated + approved) datasets.
  const datasets = canManage
    ? site.datasets
    : site.datasets.filter(isPubliclyVisible);

  return (
    <PageContainer>
      <PageHeader
        title={site.legalName + (site.abbreviation ? ` (${site.abbreviation})` : "")}
        subtitle={`${tl(`siteOrgType.${site.orgType}`)} · ${site.country}`}
        back={{ href: "/sites", label: t("title") }}
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/sites/${site.slug}/edit`}
                className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-sm font-medium hover:border-foreground transition"
              >
                {tc("edit")}
              </Link>
              <LinkButton href={`/datasets/new?siteId=${site.id}`}>
                {t("addDataset")}
              </LinkButton>
            </div>
          ) : undefined
        }
      />

      {site.description && <p className="text-sm">{site.description}</p>}
      {site.website && (
        <a
          href={site.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#5a7300] dark:text-[#A6CE39] hover:underline w-fit"
        >
          {site.website}
        </a>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("datasetsHeading")}
        </h2>
        {datasets.length === 0 ? (
          <EmptyState>
            {canManage ? t("noDatasetsManage") : t("noDatasetsVisible")}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {datasets.map((d) => (
              <Card key={d.id} href={`/datasets/${site.slug}/${d.slug}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="font-medium">
                      {d.name}
                      {d.abbreviation && (
                        <span className="text-black/40 dark:text-white/40">
                          {" "}
                          ({d.abbreviation})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-black/45 dark:text-white/45">
                      {tl(`datasetSourceType.${d.sourceType}`)} ·{" "}
                      {t("releaseCount", { count: d._count.releases })}
                    </div>
                  </div>
                  {d.visibility === "AUTHENTICATED" ? (
                    <Badge tone="green">{tc("visible")}</Badge>
                  ) : (
                    <Badge tone="amber">{tc("private")}</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Version history */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {tc("versions")}
          </h2>
          {canManage && (
            <form action={publishSiteVersion}>
              <input type="hidden" name="siteId" value={site.id} />
              <button
                type="submit"
                className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-medium hover:opacity-90 transition"
              >
                {t("publishVersion", {
                  n: (latestVersion?.versionNumber ?? 0) + 1,
                })}
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

        {site.versions.length === 0 ? (
          <EmptyState>{t("noVersions")}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {site.versions.map((v) => (
              <Card key={v.id} href={`/sites/${site.slug}/versions/${v.versionNumber}`}>
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

      {canManage && (
        <p className="text-xs text-black/45 dark:text-white/45">
          {t.rich("manageHint", {
            link: (chunks) => (
              <Link href="/datasets" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
    </PageContainer>
  );
}
