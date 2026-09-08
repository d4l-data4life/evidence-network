import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinator } from "@/lib/rbac";
import { reviewStudy } from "@/app/studies/actions";
import { reviewDataset } from "@/app/sites/actions";
import { PageContainer, PageHeader, Card, Badge, EmptyState } from "@/app/_components/ui";

export default async function ReviewPage({
  searchParams,
}: PageProps<"/review">) {
  const actor = await requireCoordinator();
  const sp = await searchParams;
  const t = await getTranslations("review");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  // PENDING submissions the actor is allowed to review (not their own/team's).
  const [studies, datasets] = await Promise.all([
    prisma.study.findMany({
      where: {
        approvalStatus: "PENDING",
        NOT: { OR: [{ ownerId: actor.id }, { members: { some: { userId: actor.id } } }] },
      },
      orderBy: { submittedAt: "asc" },
      include: { owner: { select: { name: true, orcidId: true } } },
    }),
    prisma.dataset.findMany({
      where: {
        approvalStatus: "PENDING",
        NOT: {
          OR: [
            { site: { ownerId: actor.id } },
            { site: { members: { some: { userId: actor.id } } } },
          ],
        },
      },
      orderBy: { submittedAt: "asc" },
      include: { site: { select: { legalName: true, slug: true, owner: { select: { name: true } } } } },
    }),
  ]);

  const empty = studies.length === 0 && datasets.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/dashboard", label: tc("home") }}
        action={<Badge tone="blue">{tl(`systemRole.${actor.systemRole}`)}</Badge>}
      />

      {sp.error === "own" && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {t("errorOwn")}
        </p>
      )}

      {empty ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <>
          {studies.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                {t("studiesHeading", { count: studies.length })}
              </h2>
              {studies.map((s) => (
                <ReviewCard
                  key={s.id}
                  href={`/studies/${s.slug}`}
                  title={s.title + (s.acronym ? ` (${s.acronym})` : "")}
                  meta={`${tl(`studyType.${s.studyType}`)} · ${s.owner.name ?? s.owner.orcidId ?? tc("unknown")}`}
                  action={reviewStudy}
                  idName="studyId"
                  id={s.id}
                  notePlaceholder={t("notePlaceholder")}
                  approveLabel={t("approve")}
                  rejectLabel={t("reject")}
                />
              ))}
            </section>
          )}

          {datasets.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                {t("datasetsHeading", { count: datasets.length })}
              </h2>
              {datasets.map((d) => (
                <ReviewCard
                  key={d.id}
                  href={`/datasets/${d.site.slug}/${d.slug}`}
                  title={d.name + (d.abbreviation ? ` (${d.abbreviation})` : "")}
                  meta={`${tl(`datasetSourceType.${d.sourceType}`)} · ${d.site.legalName}`}
                  action={reviewDataset}
                  idName="datasetId"
                  id={d.id}
                  notePlaceholder={t("notePlaceholder")}
                  approveLabel={t("approve")}
                  rejectLabel={t("reject")}
                />
              ))}
            </section>
          )}
        </>
      )}
    </PageContainer>
  );
}

function ReviewCard({
  href,
  title,
  meta,
  action,
  idName,
  id,
  notePlaceholder,
  approveLabel,
  rejectLabel,
}: {
  href: string;
  title: string;
  meta: string;
  action: (formData: FormData) => Promise<void>;
  idName: string;
  id: string;
  notePlaceholder: string;
  approveLabel: string;
  rejectLabel: string;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <a href={href} className="font-medium hover:underline">{title}</a>
          <span className="text-xs text-black/45 dark:text-white/45 shrink-0">{meta}</span>
        </div>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name={idName} value={id} />
          <input
            name="note"
            placeholder={notePlaceholder}
            className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground"
          />
          <button name="decision" value="APPROVE" type="submit" className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-medium hover:opacity-90 transition">
            {approveLabel}
          </button>
          <button name="decision" value="REJECT" type="submit" className="rounded-full border border-red-500/50 text-red-700 dark:text-red-300 px-4 py-1.5 text-xs font-medium hover:bg-red-500/10 transition">
            {rejectLabel}
          </button>
        </form>
      </div>
    </Card>
  );
}
