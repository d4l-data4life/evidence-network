"use client";

// ORCID sign-in button.
//
// IMPORTANT: this must NOT be a Server Action. Auth.js sets the OAuth `state`
// and PKCE `code_verifier` cookies when sign-in is initiated, but Next.js drops
// Set-Cookie headers emitted by a Server Action that redirects to an EXTERNAL
// URL (orcid.org). Those cookies would then be missing on the callback and the
// state check fails ("state cookie was missing"). Initiating sign-in from the
// client routes through Auth.js's own /api/auth/signin/orcid route handler,
// whose normal HTTP 302 response sets the cookies reliably before the browser
// leaves for ORCID. (Credentials sign-in is unaffected — it redirects to an
// internal path, so a Server Action is fine there.)

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

export function OrcidButton() {
  const t = useTranslations("login");
  return (
    <button
      type="button"
      onClick={() => signIn("orcid", { redirectTo: "/dashboard" })}
      className="w-full rounded-full border border-[#A6CE39] px-6 py-2.5 font-medium text-[#5a7300] dark:text-[#A6CE39] hover:bg-[#A6CE39]/10 transition flex items-center justify-center gap-2"
    >
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#A6CE39] text-white text-xs font-bold"
      >
        iD
      </span>
      {t("orcidButton")}
    </button>
  );
}
