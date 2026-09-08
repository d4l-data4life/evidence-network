// Public landing page — visible to everyone.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getBranding, logoUrl } from "@/lib/settings";

export default async function Home() {
  const session = await auth();
  const branding = await getBranding();
  const t = await getTranslations("landing");

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="max-w-2xl flex flex-col gap-4">
        {branding.hasLogo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logoUrl(branding)} alt="" style={{ height: branding.logoHeight, width: "auto" }} className="mx-auto" />
        )}
        <p className="text-sm font-mono uppercase tracking-widest text-black/50 dark:text-white/50">
          {branding.appName}
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          {branding.tagline ?? branding.appName}
        </h1>
        <p className="text-lg text-black/70 dark:text-white/70">
          {branding.landingIntro}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {session?.user ? (
          <Link
            href="/dashboard"
            className="rounded-full bg-foreground text-background px-6 py-3 font-medium hover:opacity-90 transition"
          >
            {t("goToDashboard")}
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-foreground text-background px-6 py-3 font-medium hover:opacity-90 transition"
          >
            {t("signIn")}
          </Link>
        )}
        <span className="text-sm text-black/50 dark:text-white/50">
          {session?.user
            ? t("signedInAs", {
                name: session.user.name ?? session.user.email ?? "you",
              })
            : t("dashboardHint")}
        </span>
      </div>
    </main>
  );
}
