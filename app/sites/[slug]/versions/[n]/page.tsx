import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageContainer, PageHeader, Badge } from "@/app/_components/ui";

// Read-only view of an immutable published Site snapshot.
export default async function SiteVersionPage({
  params,
}: PageProps<"/sites/[slug]/versions/[n]">) {
  const user = await requireUser();
  const { slug, n } = await params;
  const t = await getTranslations("sites");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");
  const versionNumber = Number.parseInt(n, 10);
  if (!Number.isInteger(versionNumber)) notFound();

  const site = await prisma.site.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      ownerId: true,
      members: { select: { userId: true } },
    },
  });
  if (!site) notFound();

  // Sites are managed content; snapshots are visible to owner/members.
  const canManage =
    site.ownerId === user.id || site.members.some((m) => m.userId === user.id);
  if (!canManage) notFound();

  const v = await prisma.siteVersion.findUnique({
    where: { siteId_versionNumber: { siteId: site.id, versionNumber } },
    include: { createdBy: { select: { name: true } } },
  });
  if (!v) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={`${v.legalName}${v.abbreviation ? ` (${v.abbreviation})` : ""}`}
        subtitle={`${tl(`siteOrgType.${v.orgType}`)} · ${v.country}`}
        back={{ href: `/sites/${site.slug}`, label: t("currentSite") }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue">{t("versionBadge", { n: v.versionNumber })}</Badge>
        <Badge>{t("readonlySnapshotBadge")}</Badge>
      </div>

      <p className="text-xs text-black/45 dark:text-white/45">
        {v.createdBy?.name
          ? t("frozenBy", {
              date: v.createdAt.toISOString().slice(0, 10),
              name: v.createdBy.name,
            })
          : t("frozen", { date: v.createdAt.toISOString().slice(0, 10) })}{" "}
        {t("immutableSuffix")}
      </p>
      {v.note && (
        <p className="text-sm rounded-md border border-black/10 dark:border-white/15 px-3 py-2">
          <span className="text-black/45 dark:text-white/45">{t("noteLabel")} </span>
          {v.note}
        </p>
      )}

      {v.description && <p className="text-sm">{v.description}</p>}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Detail label={t("website")}>
          {v.website ? (
            <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-[#5a7300] dark:text-[#A6CE39] hover:underline break-all">
              {v.website}
            </a>
          ) : tc("none")}
        </Detail>
        <Detail label={t("governanceAccess")}>{v.governancePolicy ?? tc("none")}</Detail>
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
