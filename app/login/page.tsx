// Sign-in page. Two paths, both driven by Auth.js server actions so they work
// without client-side JavaScript:
//   - username/password via the Credentials provider
//   - "Sign in with ORCID" via the ORCID OIDC provider
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { OrcidButton } from "./orcid-button";
import { getBranding, logoUrl } from "@/lib/settings";

async function credentialsSignIn(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // AuthError = bad credentials; anything else (incl. the NEXT_REDIRECT that
    // signIn throws on success) must propagate.
    if (error instanceof AuthError) {
      redirect("/login?error=CredentialsSignin");
    }
    throw error;
  }
}

const ERROR_KEYS = new Set([
  "CredentialsSignin",
  "OAuthSignin",
  "OAuthCallbackError",
  "Configuration",
]);

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const t = await getTranslations("login");
  const tc = await getTranslations("common");
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const errorMessage = errorKey
    ? t(`errors.${ERROR_KEYS.has(errorKey) ? errorKey : "default"}`)
    : undefined;

  const branding = await getBranding();

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-1">
          {branding.hasLogo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl(branding)} alt="" className="h-10 w-auto mb-1" />
          )}
          <Link
            href="/"
            className="text-sm font-mono uppercase tracking-widest text-black/50 dark:text-white/50 hover:underline"
          >
            {branding.appName}
          </Link>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        {/* Local username/password */}
        <form action={credentialsSignIn} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("username")}</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("password")}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
          <button
            type="submit"
            className="mt-1 rounded-full bg-foreground text-background px-6 py-2.5 font-medium hover:opacity-90 transition"
          >
            {t("title")}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-black/40 dark:text-white/40">
          <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
          {tc("or")}
          <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        </div>

        {/* Federated ORCID — client-initiated (see OrcidButton for why). */}
        <OrcidButton />

        <p className="text-center text-xs text-black/50 dark:text-white/50">
          {t.rich("demoHint", {
            c: (chunks) => <code className="font-mono">{chunks}</code>,
          })}
        </p>
      </div>
    </main>
  );
}
