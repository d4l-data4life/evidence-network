// Server-side locale resolution. Order of precedence:
//   1. The signed-in user's saved preference (User.locale), if it's a supported
//      and currently-enabled locale.
//   2. The system default (Setting.defaultLocale, seeded from the deployment
//      profile, editable in /admin/branding).
//   3. The build-time default (DEFAULT_LOCALE = "en").
//
// This runs once per request from next-intl's getRequestConfig (see
// i18n/request.ts). It is defensive: any failure (no DB at build time, no
// session) falls through to the next source rather than throwing.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/settings";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

export async function resolveLocale(): Promise<Locale> {
  // 1. Per-user preference — only honour it if still enabled for this deployment.
  try {
    const session = await auth();
    if (session?.user?.id) {
      const [u, branding] = await Promise.all([
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { locale: true },
        }),
        getBranding(),
      ]);
      if (isLocale(u?.locale) && branding.enabledLocales.includes(u.locale)) {
        return u.locale;
      }
      return branding.defaultLocale;
    }
  } catch {
    // fall through
  }

  // 2. System default (anonymous pages, or if the user lookup failed).
  try {
    const branding = await getBranding();
    return branding.defaultLocale;
  } catch {
    // fall through
  }

  // 3. Build-time default.
  return DEFAULT_LOCALE;
}
