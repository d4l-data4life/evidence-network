"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCurrentUser, canReview } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/slug";

// Collect repeated checkbox values for a multi-select field.
function multi(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
}

function csv(formData: FormData, key: string): string[] {
  const raw = (formData.get(key) as string | null) ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createStudy(formData: FormData) {
  const user = await requireUser();

  const title = (formData.get("title") as string | null)?.trim();
  const studyType = formData.get("studyType") as string | null;
  if (!title || !studyType) {
    redirect("/studies/new?error=missing");
  }

  const slug = await uniqueSlug(
    title,
    async (s) => (await prisma.study.count({ where: { slug: s } })) > 0,
  );

  const designType = (formData.get("designType") as string) || null;
  const status = (formData.get("status") as string) || "DRAFT";
  const visibility = (formData.get("visibility") as string) || "PRIVATE";

  const study = await prisma.study.create({
    data: {
      slug,
      title,
      acronym: (formData.get("acronym") as string) || null,
      description: (formData.get("description") as string) || null,
      objective: (formData.get("objective") as string) || null,
      studyType: studyType as never,
      designType: designType as never,
      scope: multi(formData, "scope") as never,
      conditions: csv(formData, "conditions"),
      keywords: csv(formData, "keywords"),
      status: status as never,
      visibility: visibility as never,
      designRef: (formData.get("designRef") as string) || null,
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: "LEAD", isOwner: true },
      },
    },
  });

  revalidatePath("/studies");
  redirect(`/studies/${study.slug}`);
}

// Owner or any team member may edit / version a study.
async function requireStudyManager(studyId: string, userId: string) {
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    include: { members: { where: { userId }, select: { id: true } } },
  });
  if (!study || (study.ownerId !== userId && study.members.length === 0)) {
    redirect("/studies?error=forbidden");
  }
  return study!;
}

// ── Approval workflow ────────────────────────────────────────────────────────
// Owner/member submits for publication; a coordinator/superuser who is NOT the
// owner or a member approves/rejects (separation of duties). Approval is
// separate from visibility — a study appears to others only when APPROVED AND
// visibility=AUTHENTICATED.

export async function submitStudyForApproval(formData: FormData) {
  const user = await requireUser();
  const studyId = formData.get("studyId") as string;
  const study = await requireStudyManager(studyId, user.id);
  if (study.approvalStatus !== "DRAFT" && study.approvalStatus !== "REJECTED") {
    redirect(`/studies/${study.slug}`);
  }
  await prisma.study.update({
    where: { id: studyId },
    data: { approvalStatus: "PENDING" as never, submittedAt: new Date(), reviewNote: null },
  });
  revalidatePath(`/studies/${study.slug}`);
  redirect(`/studies/${study.slug}`);
}

export async function withdrawStudy(formData: FormData) {
  const user = await requireUser();
  const studyId = formData.get("studyId") as string;
  const study = await requireStudyManager(studyId, user.id);
  if (study.approvalStatus === "PENDING") {
    await prisma.study.update({
      where: { id: studyId },
      data: { approvalStatus: "DRAFT" as never, submittedAt: null },
    });
  }
  revalidatePath(`/studies/${study.slug}`);
  redirect(`/studies/${study.slug}`);
}

// Coordinator/superuser decision. Reviewer must not be the owner or a member.
export async function reviewStudy(formData: FormData) {
  const actor = await getCurrentUser();
  if (!canReview(actor.systemRole)) redirect("/dashboard?error=forbidden");

  const studyId = formData.get("studyId") as string;
  const decision = formData.get("decision") as string; // APPROVE | REJECT
  const note = (formData.get("note") as string) || null;

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    include: { members: { where: { userId: actor.id }, select: { id: true } } },
  });
  if (!study) redirect("/review");
  // Separation of duties: cannot review your own or your team's submission.
  if (study!.ownerId === actor.id || study!.members.length > 0) {
    redirect("/review?error=own");
  }
  if (study!.approvalStatus !== "PENDING") redirect("/review");

  await prisma.study.update({
    where: { id: studyId },
    data: {
      approvalStatus: (decision === "APPROVE" ? "APPROVED" : "REJECTED") as never,
      reviewNote: decision === "REJECT" ? note : null,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });
  revalidatePath("/review");
  revalidatePath(`/studies/${study!.slug}`);
  redirect("/review");
}

// Edit the mutable "head" study in place. Does NOT create a version — use
// publishStudyVersion to freeze an immutable snapshot.
export async function updateStudy(formData: FormData) {
  const user = await requireUser();
  const studyId = formData.get("studyId") as string;
  const study = await requireStudyManager(studyId, user.id);

  const title = (formData.get("title") as string | null)?.trim();
  const studyType = formData.get("studyType") as string | null;
  if (!title || !studyType) {
    redirect(`/studies/${study.slug}/edit?error=missing`);
  }

  await prisma.study.update({
    where: { id: studyId },
    data: {
      title,
      acronym: (formData.get("acronym") as string) || null,
      description: (formData.get("description") as string) || null,
      objective: (formData.get("objective") as string) || null,
      studyType: studyType as never,
      designType: ((formData.get("designType") as string) || null) as never,
      scope: multi(formData, "scope") as never,
      conditions: csv(formData, "conditions"),
      keywords: csv(formData, "keywords"),
      status: ((formData.get("status") as string) || "DRAFT") as never,
      visibility: ((formData.get("visibility") as string) || "PRIVATE") as never,
      designRef: (formData.get("designRef") as string) || null,
    },
  });

  revalidatePath(`/studies/${study.slug}`);
  redirect(`/studies/${study.slug}`);
}

// Freeze the current head into a new immutable, numbered StudyVersion snapshot.
export async function publishStudyVersion(formData: FormData) {
  const user = await requireUser();
  const studyId = formData.get("studyId") as string;
  const study = await requireStudyManager(studyId, user.id);

  const last = await prisma.studyVersion.findFirst({
    where: { studyId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  await prisma.studyVersion.create({
    data: {
      studyId,
      versionNumber,
      // frozen copy of the head's versioned fields
      title: study.title,
      acronym: study.acronym,
      description: study.description,
      rationale: study.rationale,
      objective: study.objective,
      studyType: study.studyType,
      designType: study.designType,
      scope: study.scope,
      conditions: study.conditions,
      keywords: study.keywords,
      status: study.status,
      designRef: study.designRef,
      note: (formData.get("note") as string) || null,
      createdById: user.id,
    },
  });

  revalidatePath(`/studies/${study.slug}`);
  redirect(`/studies/${study.slug}/versions/${versionNumber}`);
}
