// Singleton branding/config. A fixed id keeps it a single row. The runtime
// values come from the DB (editable in /admin/branding); when the row is
// missing (fresh install) we fall back to the active deployment profile, which
// is also what the seed writes into the row on first run.

import { prisma } from "@/lib/prisma";
import { activeProfile } from "@/lib/deployment";
import { asLocales, isLocale, type Locale } from "@/lib/i18n/config";

export const SETTING_ID = "app";

export interface Branding {
  appName: string;
  tagline: string | null;
  landingIntro: string; // resolved (falls back to profile/default)
  logoHeight: number; // landing-page logo height in px
  accentColor: string;
  hasLogo: boolean;
  /** Cache-buster for the logo URL — changes whenever branding is saved. */
  logoVersion: number;
  // i18n
  defaultLocale: Locale; // fallback UI language for users with no preference
  enabledLocales: Locale[]; // languages offered in the switcher
}

// Read-only fetch (no writes during render). Falls back to the deployment
// profile if the settings row hasn't been seeded yet.
export async function getBranding(): Promise<Branding> {
  const profile = activeProfile();

  // Tolerate an unreachable DB (e.g. static prerendering at build time): fall
  // back to the deployment profile rather than throwing.
  const s = await prisma.setting
    .findUnique({
      where: { id: SETTING_ID },
      select: {
        appName: true, tagline: true, landingIntro: true, logoHeight: true,
        accentColor: true, logoMimeType: true, defaultLocale: true,
        enabledLocales: true, updatedAt: true,
      },
    })
    .catch(() => null);

  if (!s) {
    return {
      appName: profile.appName,
      tagline: profile.tagline,
      landingIntro: profile.landingIntro ?? "",
      logoHeight: profile.logoHeight,
      accentColor: profile.accentColor,
      hasLogo: false,
      logoVersion: 0,
      defaultLocale: profile.defaultLocale,
      enabledLocales: profile.enabledLocales,
    };
  }

  const enabled = asLocales(s.enabledLocales);
  const defaultLocale = isLocale(s.defaultLocale)
    ? s.defaultLocale
    : profile.defaultLocale;
  return {
    appName: s.appName,
    tagline: s.tagline,
    landingIntro: s.landingIntro?.trim() || profile.landingIntro || "",
    logoHeight: s.logoHeight,
    accentColor: s.accentColor,
    hasLogo: !!s.logoMimeType,
    logoVersion: s.updatedAt.getTime(),
    defaultLocale,
    enabledLocales: enabled.length ? enabled : profile.enabledLocales,
  };
}

/** The logo URL, cache-busted so a replaced logo shows immediately. */
export function logoUrl(b: Branding): string {
  return `/api/branding/logo?v=${b.logoVersion}`;
}
