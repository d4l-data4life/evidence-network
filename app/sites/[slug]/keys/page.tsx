import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { revokeApiKey } from "@/app/sites/actions";
import { PageContainer, PageHeader, Card, Badge, EmptyState } from "@/app/_components/ui";
import { CreateApiKeyForm } from "./create-form";

const H2 = "text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50";

export default async function SiteKeysPage({ params }: PageProps<"/sites/[slug]/keys">) {
  const user = await requireUser();
  const { slug } = await params;
  const t = await getTranslations("sites.keys");
  const tc = await getTranslations("common");

  const site = await prisma.site.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, legalName: true, ownerId: true,
      members: { where: { userId: user.id }, select: { id: true } },
    },
  });
  if (!site) notFound();
  const canManage = site.ownerId === user.id || site.members.length > 0;
  if (!canManage) notFound();

  const keys = await prisma.apiKey.findMany({
    where: { siteId: site.id },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });

  const now = Date.now();
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: `/sites/${site.slug}`, label: site.legalName }}
      />

      <section className="flex flex-col gap-2">
        <h2 className={H2}>{t("createHeading")}</h2>
        <CreateApiKeyForm siteId={site.id} slug={site.slug} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={H2}>{t("existingHeading")}</h2>
        {keys.length === 0 ? (
          <EmptyState>{t("none")}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map((k) => {
              const revoked = !!k.revokedAt;
              const expired = !revoked && !!k.expiresAt && k.expiresAt.getTime() < now;
              const status = revoked ? "revoked" : expired ? "expired" : "active";
              const tone = status === "active" ? "green" : status === "revoked" ? "red" : "amber";
              return (
                <Card key={k.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{k.name}</span>
                      <span className="font-mono text-xs text-black/45 dark:text-white/45">{k.prefix}…</span>
                      <span className="text-xs text-black/45 dark:text-white/45">
                        {t("createdLine", { date: day(k.createdAt) ?? "", by: k.createdBy?.name ?? tc("unknown") })}
                        {" · "}
                        {k.lastUsedAt ? t("lastUsedLine", { date: day(k.lastUsedAt) ?? "" }) : t("neverUsed")}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={tone}>{t(status)}</Badge>
                      {!revoked && (
                        <form action={revokeApiKey}>
                          <input type="hidden" name="keyId" value={k.id} />
                          <input type="hidden" name="siteId" value={site.id} />
                          <input type="hidden" name="slug" value={site.slug} />
                          <button
                            type="submit"
                            className="rounded-full border border-red-500/50 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-500/10 transition"
                          >
                            {t("revoke")}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={H2}>{t("usageHeading")}</h2>
        <p className="text-xs text-black/45 dark:text-white/45">{t("usageIntro")}</p>
        <pre className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 p-3 text-xs">
{`curl -X POST \\
  -H "Authorization: Bearer <your-key>" \\
  -H "Content-Type: application/json" \\
  --data-binary @results_<CDM>.json \\
  <host>/api/sites/${site.slug}/datasets/<dataset>/releases/<label>/dqd`}
        </pre>
        <p className="text-xs text-black/45 dark:text-white/45">{t("usageSoon")}</p>
      </section>
    </PageContainer>
  );
}
