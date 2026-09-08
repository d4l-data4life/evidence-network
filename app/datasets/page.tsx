import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  PageContainer,
  PageHeader,
  Card,
  Badge,
  EmptyState,
} from "@/app/_components/ui";

export default async function DatasetsPage() {
  const user = await requireUser();
  const t = await getTranslations("datasets");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  // Visible: any AUTHENTICATED dataset, plus datasets on sites the user manages.
  const datasets = await prisma.dataset.findMany({
    where: {
      OR: [
        { visibility: "AUTHENTICATED", approvalStatus: "APPROVED" },
        { site: { ownerId: user.id } },
        { site: { members: { some: { userId: user.id } } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      site: { select: { legalName: true, country: true, slug: true } },
      _count: { select: { releases: true } },
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/dashboard", label: tc("dashboard") }}
      />

      {datasets.length === 0 ? (
        <EmptyState>
          {t.rich("empty", {
            area: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {datasets.map((d) => (
            <Card key={d.id} href={`/datasets/${d.site.slug}/${d.slug}`}>
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
                    {tl(`datasetSourceType.${d.sourceType}`)} · {d.site.legalName} ·{" "}
                    {d.site.country} · {t("releaseCount", { count: d._count.releases })}
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
    </PageContainer>
  );
}
