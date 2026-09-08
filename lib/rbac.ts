// System-role helpers. Authorization always reads the role FRESH from the DB
// (not the session/JWT) so promote/demote takes effect immediately.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type SystemRole = "USER" | "COORDINATOR" | "SUPERUSER";

export interface CurrentUser {
  id: string;
  name: string | null;
  systemRole: SystemRole;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await requireUser();
  const u = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, systemRole: true },
  });
  if (!u) redirect("/login");
  return u as CurrentUser;
}

export const canReview = (r: SystemRole) => r === "COORDINATOR" || r === "SUPERUSER";
export const isSuperuser = (r: SystemRole) => r === "SUPERUSER";

export async function requireCoordinator(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!canReview(u.systemRole)) redirect("/dashboard?error=forbidden");
  return u;
}

export async function requireSuperuser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!isSuperuser(u.systemRole)) redirect("/dashboard?error=forbidden");
  return u;
}
