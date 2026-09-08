// Per-user color-theme preference. Stored on User.theme so it follows the
// account, not the browser (localStorage leaked the last user's choice on a
// shared browser). "system" (or null) means follow the OS setting, which can
// only be known client-side — the inline script in the root layout resolves
// that case before paint; explicit light/dark are rendered server-side.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const THEMES = ["light", "system", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "system";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "system" || value === "dark";
}

// Resolve the signed-in user's stored theme preference. Anonymous users (and any
// failure) default to "system". Never throws (build-time safe).
export async function resolveTheme(): Promise<Theme> {
  try {
    const session = await auth();
    if (session?.user?.id) {
      const u = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { theme: true },
      });
      if (isTheme(u?.theme)) return u.theme;
    }
  } catch {
    // fall through
  }
  return DEFAULT_THEME;
}
