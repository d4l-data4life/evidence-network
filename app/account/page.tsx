import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/settings";
import { LOCALE_LABELS } from "@/lib/i18n/config";
import { isTheme, type Theme } from "@/lib/theme";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { setLocale } from "./actions";

async function doSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Read identity fresh from the DB (the JWT can be stale after a rename/role change).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, orcidId: true, systemRole: true,
      locale: true, theme: true,
    },
  });
  if (!user) redirect("/login");

  const currentTheme: Theme = isTheme(user.theme) ? user.theme : "system";

  const t = await getTranslations("account");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");
  const tTheme = await getTranslations("theme");
  const tLang = await getTranslations("language");
  const branding = await getBranding();

  const provider = session.user.provider; // login method is a session fact
  const loginMethod =
    provider === "orcid"
      ? t("loginMethodOrcid")
      : provider === "credentials"
        ? t("loginMethodCredentials")
        : (provider ?? t("loginMethodUnknown"));

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/dashboard", label: tc("home") }}
      />

      <dl className="rounded-lg border border-black/10 dark:border-white/15 divide-y divide-black/10 dark:divide-white/15 text-sm">
        <Row label={t("rowName")} value={user.name ?? tc("none")} />
        <Row label={t("rowEmail")} value={user.email ?? t("emailNone")} />
        <Row label={t("rowRole")} value={tl(`systemRole.${user.systemRole}`)} />
        <Row label={t("rowUserId")} value={user.id} mono />
        <Row label={t("rowLoginMethod")} value={loginMethod} />
        <Row label={t("rowOrcid")} value={user.orcidId ?? tc("none")} mono />
      </dl>

      {/* Language — persisted to the user's profile (DB). */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {tLang("heading")}
        </h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          {tLang("description")}
        </p>
        <form action={setLocale} className="flex items-center gap-2">
          <select
            name="locale"
            defaultValue={user.locale ?? "system"}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
          >
            <option value="system">{tLang("systemDefault")}</option>
            {branding.enabledLocales.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full border border-black/20 dark:border-white/25 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            {tLang("save")}
          </button>
        </form>
      </section>

      {/* Appearance — theme is a per-browser preference (localStorage). */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {tTheme("heading")}
        </h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          {tTheme("description")}
        </p>
        <ThemeToggle current={currentTheme} />
      </section>

      <form action={doSignOut}>
        <button
          type="submit"
          className="rounded-full border border-black/20 dark:border-white/25 px-6 py-2.5 font-medium hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          {tc("signOut")}
        </button>
      </form>
    </PageContainer>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className={mono ? "font-mono text-right break-all" : "text-right"}>
        {value}
      </dd>
    </div>
  );
}
