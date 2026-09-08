import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { publishStudyVersion, submitStudyForApproval, withdrawStudy } from "../actions";
import { getCurrentUser, canReview } from "@/lib/rbac";
import { isPubliclyVisible } from "@/lib/visibility";
import { PageContainer, PageHeader, Badge, Card, EmptyState, ApprovalBadge } from "@/app/_components/ui";

export default async function StudyDetailPage({
  params,
}: PageProps<"/studies/[slug]">) {
  const user = await getCurrentUser();
  const { slug } = await params;
  const t = await getTranslations("studies");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  const study = await prisma.study.findUnique({
    where: { slug },
    include: {
      owner: { select: { name: true, orcidId: true } },
      members: {
        include: { user: { select: { name: true, orcidId: true } } },
        orderBy: { createdAt: "asc" },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!study) notFound();

  // Enforce visibility: non-team users only see studies that are AUTHENTICATED
  // AND APPROVED.
  const isMember =
    study.ownerId === user.id ||
    study.members.some((m) => m.userId === user.id);
  // Coordinators/superusers may view any study (e.g. to review a submission).
  if (!isMember && !isPubliclyVisible(study) && !canReview(user.systemRole)) {
    notFound();
  }

  const canManage = isMember;
  const latestVersion = study.versions[0];
  // "Unpublished changes" = the head was edited after the last snapshot (or no
  // snapshot exists yet).
  const hasUnpublishedChanges =
    !latestVersion || study.updatedAt > latestVersion.createdAt;

  return (
    <PageContainer>
      <PageHeader
        title={study.title + (study.acronym ? ` (${study.acronym})` : "")}
        subtitle={study.objective ?? undefined}
        back={{ href: "/studies", label: t("title") }}
        action={
          canManage ? (
            <Link
              href={`/studies/${study.slug}/edit`}
              className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-sm font-medium hover:border-foreground transition"
            >
              {tc("edit")}
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">{tl(`studyStatus.${study.status}`)}</Badge>
        <Badge>{tl(`studyType.${study.studyType}`)}</Badge>
        {study.designType && <Badge>{tl(`studyDesignType.${study.designType}`)}</Badge>}
        {study.visibility === "AUTHENTICATED" ? (
          <Badge tone="green">{tl("visibility.AUTHENTICATED")}</Badge>
        ) : (
          <Badge tone="amber">{tl("visibility.PRIVATE")}</Badge>
        )}
        <ApprovalBadge status={study.approvalStatus} />
      </div>

      {/* Publication / approval panel (owner & members) */}
      {canManage && (
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-black/60 dark:text-white/60">
              {isPubliclyVisible(study)
                ? t("pub.published")
                : study.approvalStatus === "PENDING"
                  ? t("pub.submitted")
                  : study.approvalStatus === "APPROVED"
                    ? t("pub.approved")
                    : t("pub.notPublished")}
            </span>
            {(study.approvalStatus === "DRAFT" || study.approvalStatus === "REJECTED") && (
              <form action={submitStudyForApproval}>
                <input type="hidden" name="studyId" value={study.id} />
                <button type="submit" className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-medium hover:opacity-90 transition">
                  {t("submitForPublication")}
                </button>
              </form>
            )}
            {study.approvalStatus === "PENDING" && (
              <form action={withdrawStudy}>
                <input type="hidden" name="studyId" value={study.id} />
                <button type="submit" className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-xs font-medium hover:border-foreground transition">
                  {t("withdraw")}
                </button>
              </form>
            )}
          </div>
          {study.approvalStatus === "REJECTED" && study.reviewNote && (
            <p className="text-xs text-red-700 dark:text-red-300">
              {t("rejected", { note: study.reviewNote })}
            </p>
          )}
        </div>
      )}

      {study.description && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {tc("description")}
          </h2>
          <p className="text-sm">{study.description}</p>
        </section>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Detail label={t("scope")}>
          {study.scope.length
            ? study.scope.map((s) => tl(`studyScope.${s}`)).join(", ")
            : tc("none")}
        </Detail>
        <Detail label={t("conditions")}>
          {study.conditions.length ? study.conditions.join(", ") : tc("none")}
        </Detail>
        <Detail label={t("keywords")}>
          {study.keywords.length ? study.keywords.join(", ") : tc("none")}
        </Detail>
        <Detail label={tc("owner")}>
          {study.owner.name ?? study.owner.orcidId ?? tc("none")}
        </Detail>
        <Detail label={t("designReference")}>
          {study.designRef ? (
            <a
              href={study.designRef}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5a7300] dark:text-[#A6CE39] hover:underline break-all"
            >
              {study.designRef}
            </a>
          ) : (
            t("designRefEmpty")
          )}
        </Detail>
      </dl>

      {/* Version history */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {tc("versions")}
          </h2>
          {canManage && (
            <form action={publishStudyVersion}>
              <input type="hidden" name="studyId" value={study.id} />
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
              ? t("unpublishedSince", { n: latestVersion.versionNumber })
              : t("noVersionsDraft")}
          </p>
        )}

        {study.versions.length === 0 ? (
          <EmptyState>{t("noVersions")}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {study.versions.map((v) => (
              <Card key={v.id} href={`/studies/${study.slug}/versions/${v.versionNumber}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge tone="blue">v{v.versionNumber}</Badge>
                    <span className="text-black/60 dark:text-white/60">
                      {v.createdAt.toISOString().slice(0, 10)}
                      {v.createdBy?.name ? ` · ${v.createdBy.name}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {v.note ? v.note.slice(0, 60) : t("snapshotNote")}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {tc("team")}
        </h2>
        {study.members.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between text-sm">
              <span>{m.user.name ?? m.user.orcidId ?? tc("unknown")}</span>
              <Badge tone={m.isOwner ? "green" : "neutral"}>
                {t(`role.${m.role}`)}
                {m.isOwner ? ` · ${tc("owner")}` : ""}
              </Badge>
            </div>
          </Card>
        ))}
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
      <dt className="text-xs uppercase tracking-wide text-black/45 dark:text-white/45">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
