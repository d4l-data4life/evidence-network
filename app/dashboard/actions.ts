"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { runMatchingForUser } from "@/lib/matching/compute";

export async function runMatchingForMe() {
  const user = await requireUser();
  await runMatchingForUser(user.id, "ON_DEMAND");
  revalidatePath("/dashboard");
}

// Dismiss a match from one side (the side the current user represents).
export async function dismissMatch(formData: FormData) {
  const user = await requireUser();
  const matchId = formData.get("matchId") as string;
  const side = formData.get("side") as string; // "study" | "dataset"

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      study: { select: { ownerId: true, members: { select: { userId: true } } } },
      dataset: {
        select: { site: { select: { ownerId: true, members: { select: { userId: true } } } } },
      },
    },
  });
  if (!match) redirect("/dashboard");

  if (side === "study") {
    const allowed =
      match!.study.ownerId === user.id ||
      match!.study.members.some((m) => m.userId === user.id);
    if (allowed) {
      await prisma.match.update({
        where: { id: matchId },
        data: { studyOwnerState: "DISMISSED" as never },
      });
    }
  } else {
    const allowed =
      match!.dataset.site.ownerId === user.id ||
      match!.dataset.site.members.some((m) => m.userId === user.id);
    if (allowed) {
      await prisma.match.update({
        where: { id: matchId },
        data: { siteOwnerState: "DISMISSED" as never },
      });
    }
  }

  revalidatePath("/dashboard");
}
