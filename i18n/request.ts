// next-intl request configuration (App Router, WITHOUT i18n routing — the locale
// is not carried in the URL but resolved per request from the user's DB
// preference / the system default; see lib/i18n/resolve.ts).
//
// Messages are split across a base catalog (messages/<locale>.json — shared
// chrome, dashboard, account, admin, enum labels) plus one file per domain
// under messages/<locale>/ (studies, sites, datasets, review, admin-users).
// Each domain file has a single distinct top-level namespace, so a shallow
// merge composes them without collisions.

import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/resolve";

const DOMAINS = ["studies", "sites", "datasets", "review", "admin-users"] as const;

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  const [base, ...domains] = await Promise.all([
    import(`../messages/${locale}.json`),
    ...DOMAINS.map((d) => import(`../messages/${locale}/${d}.json`)),
  ]);

  const messages = Object.assign(
    {},
    base.default,
    ...domains.map((m) => m.default),
  );

  return { locale, messages };
});
