"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isLocale } from "@/lib/i18n/config";
import { isTheme } from "@/lib/theme";
import { getBranding } from "@/lib/settings";

// Persist the signed-in user's preferred UI language. The sentinel "system"
// clears the preference so the user follows the deployment's default locale.
export async function setLocale(formData: FormData) {
  const user = await requireUser();
  const raw = (formData.get("locale") as string | null) ?? "system";

  let value: string | null = null;
  if (raw !== "system" && isLocale(raw)) {
    const branding = await getBranding();
    if (branding.enabledLocales.includes(raw)) value = raw;
  }

  await prisma.user.update({ where: { id: user.id }, data: { locale: value } });
  // The locale drives the whole tree (see i18n/request.ts), so revalidate root.
  revalidatePath("/", "layout");
  redirect("/account");
}

// Persist the signed-in user's preferred color theme. Called from the client
// ThemeToggle (which also applies the change optimistically). "system" clears
// the explicit choice so the user follows the OS setting.
export async function setTheme(pref: string) {
  const user = await requireUser();
  const value = isTheme(pref) && pref !== "system" ? pref : null;
  await prisma.user.update({ where: { id: user.id }, data: { theme: value } });
  // The theme class is rendered on <html> in the root layout, so revalidate root.
  revalidatePath("/", "layout");
}

