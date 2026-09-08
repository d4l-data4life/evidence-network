// Session helper for server components / actions in the authenticated area.
// Routes under /dashboard, /studies, /sites, /datasets are already gated by the
// proxy (see proxy.ts), but this gives a typed, non-null user and a defensive
// redirect for direct server-action calls.

import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}
