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

export default async function StudiesPage() {
  const user = await requireUser();
  const t = await getTranslations("studies");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  // Visible: any AUTHENTICATED study, plus the user's own / member studies.
  const studies = await prisma.study.findMany({
    where: {
      OR: [
        { visibility: "AUTHENTICATED", approvalStatus: "APPROVED" },
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true, orcidId: true } } },
  });

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/dashboard", label: tc("dashboard") }}
        action={<LinkButton href="/studies/new">{t("new")}</LinkButton>}
      />

      {studies.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {studies.map((s) => (
            <Card key={s.id} href={`/studies/${s.slug}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="font-medium">
                    {s.title}
                    {s.acronym && (
                      <span className="text-black/40 dark:text-white/40">
                        {" "}
                        ({s.acronym})
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-sm text-black/60 dark:text-white/60 line-clamp-2">
                      {s.description}
                    </p>
                  )}
                  <div className="text-xs text-black/45 dark:text-white/45">
                    {tl(`studyType.${s.studyType}`)} ·{" "}
                    {s.owner.name ?? s.owner.orcidId ?? t("unknownOwner")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge tone="blue">{tl(`studyStatus.${s.status}`)}</Badge>
                  {s.visibility === "AUTHENTICATED" ? (
                    <Badge tone="green">{tc("visible")}</Badge>
                  ) : (
                    <Badge>{tc("private")}</Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
