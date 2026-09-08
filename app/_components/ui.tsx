// Small server-safe presentational components shared across the app's pages,
// matching the app's minimal Tailwind look. No client JS.

import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <Link
          href={back.href}
          className="text-xs font-mono uppercase tracking-widest text-black/50 dark:text-white/50 hover:underline w-fit"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && (
            <p className="text-sm text-black/60 dark:text-white/60">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}

const badgeTones: Record<string, string> = {
  neutral: "border-black/15 dark:border-white/20 text-black/60 dark:text-white/60",
  green: "border-[#A6CE39] text-[#5a7300] dark:text-[#A6CE39]",
  blue: "border-blue-500/40 text-blue-700 dark:text-blue-300",
  amber: "border-amber-500/50 text-amber-700 dark:text-amber-300",
  red: "border-red-500/50 text-red-700 dark:text-red-300",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

const APPROVAL_TONE: Record<string, keyof typeof badgeTones> = {
  DRAFT: "neutral",
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

export async function ApprovalBadge({ status }: { status: string }) {
  const t = await getTranslations("labels.approval");
  const label = ["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(status)
    ? t(status)
    : status;
  return <Badge tone={APPROVAL_TONE[status] ?? "neutral"}>{label}</Badge>;
}

export function Card({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "block rounded-lg border border-black/10 dark:border-white/15 p-4 " +
    (href ? "hover:border-foreground transition" : "");
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 dark:border-white/20 p-8 text-center text-sm text-black/50 dark:text-white/50">
      {children}
    </div>
  );
}

export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium hover:opacity-90 transition w-fit"
    >
      {children}
    </Link>
  );
}
