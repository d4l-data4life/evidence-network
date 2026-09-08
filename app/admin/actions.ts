"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperuser } from "@/lib/rbac";
import { SETTING_ID } from "@/lib/settings";
import { DEFAULT_LOCALE, asLocales, isLocale } from "@/lib/i18n/config";

export async function setUserRole(formData: FormData) {
  const actor = await requireSuperuser();
  const userId = formData.get("userId") as string;
  const role = formData.get("role") as string; // USER | COORDINATOR | SUPERUSER

  // Guard against locking yourself out of the admin area.
  if (userId === actor.id && role !== "SUPERUSER") {
    redirect("/admin/users?error=self");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { systemRole: role as never },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateBranding(formData: FormData) {
  await requireSuperuser();
  const appName = ((formData.get("appName") as string) || "Evidence Network").trim();
  const tagline = (formData.get("tagline") as string) || null;
  const landingIntro = ((formData.get("landingIntro") as string) || "").trim() || null;
  const accentColor = ((formData.get("accentColor") as string) || "#A6CE39").trim();
  // Landing logo height in px, clamped to a sane range.
  const rawHeight = Number.parseInt((formData.get("logoHeight") as string) || "48", 10);
  const logoHeight = Number.isFinite(rawHeight) ? Math.min(240, Math.max(16, rawHeight)) : 48;

  // i18n: offered languages (checkbox group) + default (must be one of them).
  let enabledLocales = asLocales(formData.getAll("enabledLocales") as string[]);
  if (enabledLocales.length === 0) enabledLocales = [DEFAULT_LOCALE];
  const rawDefault = formData.get("defaultLocale") as string | null;
  const defaultLocale =
    isLocale(rawDefault) && enabledLocales.includes(rawDefault)
      ? rawDefault
      : enabledLocales[0];

  // Optional logo upload (stored in the DB so it works without a volume).
  const file = formData.get("logo") as File | null;
  let logoData: { logo: Uint8Array<ArrayBuffer>; logoMimeType: string } | null = null;
  if (file && typeof file === "object" && file.size > 0) {
    const src = new Uint8Array(await file.arrayBuffer());
    // Allocate a fresh ArrayBuffer-backed array (Prisma Bytes wants Uint8Array<ArrayBuffer>).
    const bytes = new Uint8Array(src.byteLength);
    bytes.set(src);
    logoData = { logo: bytes, logoMimeType: file.type || "image/png" };
  }

  await prisma.setting.upsert({
    where: { id: SETTING_ID },
    create: { id: SETTING_ID, appName, tagline, landingIntro, logoHeight, accentColor, defaultLocale, enabledLocales, ...(logoData ?? {}) },
    update: { appName, tagline, landingIntro, logoHeight, accentColor, defaultLocale, enabledLocales, ...(logoData ?? {}) },
  });

  revalidatePath("/admin/branding");
  redirect("/admin/branding");
}
