// Deployment profiles — repo-level presets that give each instance of the
// Evidence Network its identity (name, tagline, colours, default language, and
// the set of offered languages). One profile is selected at boot via the
// `DEPLOYMENT` env var, e.g. `DEPLOYMENT=example-es`.
//
// A profile only supplies DEFAULTS: the values seeded into the branding
// singleton on first run (see prisma/seed.mjs) and the fallback used before the
// DB row exists. A superuser can still override everything at runtime in
// /admin/branding. This is the layer that makes the app customisable for
// different networks (e.g. regional or thematic ones) or the Data4Life Data
// Library node without code changes.

import { DEFAULT_LOCALE, asLocales, isLocale, type Locale } from "@/lib/i18n/config";
import rawProfiles from "./profiles.json";

export interface DeploymentProfile {
  appName: string;
  tagline: string | null;
  landingIntro: string | null;
  accentColor: string;
  logoHeight: number;
  defaultLocale: Locale;
  enabledLocales: Locale[];
}

const profiles = rawProfiles as Record<
  string,
  {
    appName: string;
    tagline: string | null;
    landingIntro: string | null;
    accentColor: string;
    logoHeight: number;
    defaultLocale: string;
    enabledLocales: string[];
  }
>;

/** The active deployment key (lower-cased), defaulting to "default". */
export function deploymentKey(): string {
  return (process.env.DEPLOYMENT || "default").toLowerCase();
}

export function activeProfile(): DeploymentProfile {
  const raw = profiles[deploymentKey()] ?? profiles.default;
  const enabled = asLocales(raw.enabledLocales);
  const defaultLocale = isLocale(raw.defaultLocale)
    ? raw.defaultLocale
    : DEFAULT_LOCALE;
  return {
    appName: raw.appName,
    tagline: raw.tagline,
    landingIntro: raw.landingIntro,
    accentColor: raw.accentColor,
    logoHeight: raw.logoHeight,
    defaultLocale,
    enabledLocales: enabled.length ? enabled : [DEFAULT_LOCALE],
  };
}
