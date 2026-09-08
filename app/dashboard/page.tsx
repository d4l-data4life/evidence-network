// Home for signed-in users: an operational overview — a matches hero (datasets
// matching my studies, and studies addressable by my datasets), a "Run matching
// now" button, and summary counts. Account/session details live at /account.

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canReview, isSuperuser } from "@/lib/rbac";
import { rationaleSummary, type ScoreResult } from "@/lib/matching/signals";
import { runMatchingForMe } from "./actions";
import {
  PageContainer,
  PageHeader,
  Card,
  Badge,
  EmptyState,
} from "@/app/_components/ui";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const uid = user.id;
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");

  const [studies, sites, datasets, studySideMatches, datasetSideMatches] =
    await Promise.all([
      prisma.study.findMany({
        where: { OR: [{ ownerId: uid }, { members: { some: { userId: uid } } }] },
        orderBy: { updatedAt: "desc" },
        select: { id: true, slug: true, title: true, acronym: true },
      }),
      prisma.site.findMany({
        where: { OR: [{ ownerId: uid }, { members: { some: { userId: uid } } }] },
        orderBy: { updatedAt: "desc" },
        select: { id: true, slug: true, legalName: true, _count: { select: { datasets: true } } },
      }),
      prisma.dataset.findMany({
        where: {
          OR: [
            { site: { ownerId: uid } },
            { site: { members: { some: { userId: uid } } } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, slug: true, name: true, site: { select: { slug: true } } },
      }),
      // Datasets matching my studies (dataset must be visible to me).
      prisma.match.findMany({
        where: {
          band: { in: ["STRONG", "POSSIBLE"] },
          studyOwnerState: { not: "DISMISSED" },
          study: { OR: [{ ownerId: uid }, { members: { some: { userId: uid } } }] },
          dataset: {
            OR: [
              { visibility: "AUTHENTICATED", approvalStatus: "APPROVED" },
              { site: { ownerId: uid } },
              { site: { members: { some: { userId: uid } } } },
            ],
          },
        },
        orderBy: { score: "desc" },
        include: {
          study: { select: { slug: true, title: true, acronym: true } },
          dataset: {
            select: { slug: true, name: true, abbreviation: true, site: { select: { legalName: true, slug: true } } },
          },
        },
      }),
      // Studies addressable by my datasets (study must be visible to me).
      prisma.match.findMany({
        where: {
          band: { in: ["STRONG", "POSSIBLE"] },
          siteOwnerState: { not: "DISMISSED" },
          dataset: {
            OR: [
              { site: { ownerId: uid } },
              { site: { members: { some: { userId: uid } } } },
            ],
          },
          study: { OR: [{ visibility: "AUTHENTICATED", approvalStatus: "APPROVED" }, { ownerId: uid }, { members: { some: { userId: uid } } }] },
        },
        orderBy: { score: "desc" },
        include: {
          dataset: { select: { slug: true, name: true, abbreviation: true, site: { select: { slug: true } } } },
          study: { select: { slug: true, title: true, acronym: true, studyType: true } },
        },
      }),
    ]);

  return (
    <PageContainer>
      <PageHeader
        title={user.name ? t("welcomeName", { name: user.name }) : t("welcome")}
        subtitle={t("subtitle")}
        action={
          <Link href="/account" className="text-xs font-mono uppercase tracking-widest text-black/50 dark:text-white/50 hover:underline">
            {tc("account")}
          </Link>
        }
      />

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <QuickAction href="/studies/new" label={t("quick.newStudy")} />
        <QuickAction href="/sites/new" label={t("quick.enrollSite")} />
        <QuickAction href="/datasets" label={t("quick.browseDatasets")} />
        {canReview(user.systemRole) && (
          <QuickAction href="/review" label={t("quick.reviewQueue")} />
        )}
        {isSuperuser(user.systemRole) && (
          <QuickAction href="/admin/branding" label={t("quick.admin")} />
        )}
      </div>

      {/* Matches hero */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("matchesHeading")}
          </h2>
          <form action={runMatchingForMe}>
            <button
              type="submit"
              className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-medium hover:opacity-90 transition"
            >
              {t("runMatching")}
            </button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MatchColumn
            title={t("datasetsMatchingStudies")}
            newLabel={tc("new")}
            groups={groupBy(studySideMatches, (m) => m.study.slug)}
            renderGroupTitle={(m) => titleOf(m.study.title, m.study.acronym)}
            renderItem={(m) => ({
              href: `/datasets/${m.dataset.site.slug}/${m.dataset.slug}`,
              primary: titleOf(m.dataset.name, m.dataset.abbreviation),
              secondary: m.dataset.site.legalName,
              score: m.score,
              bandLabel: tl(`matchBand.${m.band}`),
              isNew: m.studyOwnerState === "NEW",
              strong: m.band === "STRONG",
              summary: rationaleSummary(m.rationale as unknown as ScoreResult),
            })}
            emptyText={t("emptyDatasets")}
          />
          <MatchColumn
            title={t("studiesAddressable")}
            newLabel={tc("new")}
            groups={groupBy(datasetSideMatches, (m) => `${m.dataset.site.slug}/${m.dataset.slug}`)}
            renderGroupTitle={(m) => titleOf(m.dataset.name, m.dataset.abbreviation)}
            renderItem={(m) => ({
              href: `/studies/${m.study.slug}`,
              primary: titleOf(m.study.title, m.study.acronym),
              secondary: tl(`studyType.${m.study.studyType}`),
              score: m.score,
              bandLabel: tl(`matchBand.${m.band}`),
              isNew: m.siteOwnerState === "NEW",
              strong: m.band === "STRONG",
              summary: rationaleSummary(m.rationale as unknown as ScoreResult),
            })}
            emptyText={t("emptyStudies")}
          />
        </div>
      </section>

      {/* Summary row */}
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title={t("summaryStudies")} viewAll={tc("viewAll")} count={studies.length} href="/studies" items={studies.map((s) => ({ label: s.acronym ?? s.title, href: `/studies/${s.slug}` }))} />
        <SummaryCard title={t("summarySites")} viewAll={tc("viewAll")} count={sites.length} href="/sites" items={sites.map((s) => ({ label: `${s.legalName} (${s._count.datasets})`, href: `/sites/${s.slug}` }))} />
        <SummaryCard title={t("summaryDatasets")} viewAll={tc("viewAll")} count={datasets.length} href="/datasets" items={datasets.map((d) => ({ label: d.name, href: `/datasets/${d.site.slug}/${d.slug}` }))} />
      </section>
    </PageContainer>
  );
}

// ── helpers / small components ───────────────────────────────────────────────

function titleOf(name: string, acronym?: string | null): string {
  return acronym ? `${name} (${acronym})` : name;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    (m.get(k) ?? m.set(k, []).get(k)!).push(it);
  }
  return m;
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-sm font-medium hover:border-foreground transition"
    >
      {label}
    </Link>
  );
}

interface ItemView {
  href: string;
  primary: string;
  secondary: string;
  score: number;
  bandLabel: string;
  strong: boolean;
  isNew: boolean;
  summary: string;
}

function MatchColumn<T>({
  title,
  newLabel,
  groups,
  renderGroupTitle,
  renderItem,
  emptyText,
}: {
  title: string;
  newLabel: string;
  groups: Map<string, T[]>;
  renderGroupTitle: (first: T) => string;
  renderItem: (m: T) => ItemView;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-black/60 dark:text-white/60">{title}</h3>
      {groups.size === 0 ? (
        <EmptyState>{emptyText}</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {[...groups.values()].map((items) => (
            <div key={renderGroupTitle(items[0])} className="rounded-lg border border-black/10 dark:border-white/15 p-3 flex flex-col gap-2">
              <div className="text-sm font-medium">{renderGroupTitle(items[0])}</div>
              {items.slice(0, 3).map((m, i) => {
                const v = renderItem(m);
                return (
                  <Link
                    key={i}
                    href={v.href}
                    className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{v.primary}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {v.isNew && <Badge tone="blue">{newLabel}</Badge>}
                        <Badge tone={v.strong ? "green" : "amber"}>
                          {v.bandLabel} {v.score}
                        </Badge>
                      </span>
                    </div>
                    <span className="text-xs text-black/45 dark:text-white/45">{v.secondary}</span>
                    <span className="text-xs text-black/40 dark:text-white/40 italic">{v.summary}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  viewAll,
  count,
  href,
  items,
}: {
  title: string;
  viewAll: string;
  count: number;
  href: string;
  items: { label: string; href: string }[];
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {items.slice(0, 3).map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="text-sm text-black/60 dark:text-white/60 hover:underline line-clamp-1">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-2 inline-block text-xs text-[#5a7300] dark:text-[#A6CE39] hover:underline">
        {viewAll}
      </Link>
    </Card>
  );
}
