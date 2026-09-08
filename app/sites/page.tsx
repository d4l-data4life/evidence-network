import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  PageContainer,
  PageHeader,
  Card,
  Badge,
  EmptyState,
  LinkButton,
} from "@/app/_components/ui";

export default async function SitesPage({
  searchParams,
}: PageProps<"/sites">) {
  const user = await requireUser();
  const params = await searchParams;
  const t = await getTranslations("sites");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  // Sites the user owns or is a member of.
  const sites = await prisma.site.findMany({
    where: {
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { datasets: true } } },
  });

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/dashboard", label: tc("dashboard") }}
        action={<LinkButton href="/sites/new">{t("enrollSite")}</LinkButton>}
      />

      {params.error === "forbidden" && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorForbidden")}
        </p>
      )}

      {sites.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {sites.map((site) => (
            <Card key={site.id} href={`/sites/${site.slug}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="font-medium">
                    {site.legalName}
                    {site.abbreviation && (
                      <span className="text-black/40 dark:text-white/40">
                        {" "}
                        ({site.abbreviation})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-black/45 dark:text-white/45">
                    {tl(`siteOrgType.${site.orgType}`)} · {site.country}
                  </div>
                </div>
                <Badge>
                  {t("datasetCount", { count: site._count.datasets })}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
