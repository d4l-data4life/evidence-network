"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCurrentUser, canReview } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/slug";

function multi(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
}

function csv(formData: FormData, key: string): string[] {
  return ((formData.get(key) as string | null) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Is `userId` allowed to manage `siteId` (owner or member)?
async function canManageSite(siteId: string, userId: string): Promise<boolean> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { ownerId: true, members: { where: { userId }, select: { id: true } } },
  });
  return !!site && (site.ownerId === userId || site.members.length > 0);
}

export async function createSite(formData: FormData) {
  const user = await requireUser();

  const legalName = (formData.get("legalName") as string | null)?.trim();
  const country = (formData.get("country") as string | null)?.trim();
  const orgType = formData.get("orgType") as string | null;
  if (!legalName || !country || !orgType) {
    redirect("/sites/new?error=missing");
  }

  const slug = await uniqueSlug(
    legalName,
    async (s) => (await prisma.site.count({ where: { slug: s } })) > 0,
  );

  const site = await prisma.site.create({
    data: {
      slug,
      legalName,
      abbreviation: (formData.get("abbreviation") as string) || null,
      country,
      orgType: orgType as never,
      description: (formData.get("description") as string) || null,
      website: (formData.get("website") as string) || null,
      governancePolicy: (formData.get("governancePolicy") as string) || null,
      ownerId: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  revalidatePath("/sites");
  redirect(`/sites/${site.slug}`);
}

// Edit the mutable Site "head" in place. Versions are frozen via publishSiteVersion.
export async function updateSite(formData: FormData) {
  const user = await requireUser();
  const siteId = formData.get("siteId") as string;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { slug: true } });
  if (!site || !(await canManageSite(siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }

  const legalName = (formData.get("legalName") as string | null)?.trim();
  const country = (formData.get("country") as string | null)?.trim();
  const orgType = formData.get("orgType") as string | null;
  if (!legalName || !country || !orgType) {
    redirect(`/sites/${site!.slug}/edit?error=missing`);
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      legalName,
      abbreviation: (formData.get("abbreviation") as string) || null,
      country,
      orgType: orgType as never,
      description: (formData.get("description") as string) || null,
      website: (formData.get("website") as string) || null,
      governancePolicy: (formData.get("governancePolicy") as string) || null,
    },
  });

  revalidatePath(`/sites/${site!.slug}`);
  redirect(`/sites/${site!.slug}`);
}

// Freeze the current Site head into a new immutable, numbered SiteVersion.
export async function publishSiteVersion(formData: FormData) {
  const user = await requireUser();
  const siteId = formData.get("siteId") as string;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site || !(await canManageSite(siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }

  const last = await prisma.siteVersion.findFirst({
    where: { siteId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  await prisma.siteVersion.create({
    data: {
      siteId,
      versionNumber,
      legalName: site!.legalName,
      abbreviation: site!.abbreviation,
      country: site!.country,
      orgType: site!.orgType,
      description: site!.description,
      website: site!.website,
      governancePolicy: site!.governancePolicy,
      note: (formData.get("note") as string) || null,
      createdById: user.id,
    },
  });

  revalidatePath(`/sites/${site!.slug}`);
  redirect(`/sites/${site!.slug}/versions/${versionNumber}`);
}

export async function createDataset(formData: FormData) {
  const user = await requireUser();

  const siteId = formData.get("siteId") as string | null;
  const name = (formData.get("name") as string | null)?.trim();
  const sourceType = formData.get("sourceType") as string | null;
  if (!siteId || !(await canManageSite(siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }
  if (!name || !sourceType) {
    redirect(`/datasets/new?siteId=${siteId}&error=missing`);
  }

  // Slug is unique PER SITE (URLs are /datasets/{siteSlug}/{datasetSlug}).
  const slug = await uniqueSlug(
    name,
    async (s) =>
      (await prisma.dataset.count({ where: { siteId: siteId as string, slug: s } })) > 0,
  );

  const dataset = await prisma.dataset.create({
    data: {
      slug,
      siteId: siteId as string,
      name,
      abbreviation: (formData.get("abbreviation") as string) || null,
      sourceType: sourceType as never,
      careSetting: multi(formData, "careSetting") as never,
      therapeuticAreas: csv(formData, "therapeuticAreas"),
      sourceCodingSystems: csv(formData, "sourceCodingSystems"),
      description: (formData.get("description") as string) || null,
      visibility: ((formData.get("visibility") as string) || "PRIVATE") as never,
    },
    include: { site: { select: { slug: true } } },
  });

  revalidatePath(`/sites`);
  redirect(`/datasets/${dataset.site.slug}/${dataset.slug}`);
}

// Edit the mutable Dataset "head" (catalog metadata) in place.
export async function updateDataset(formData: FormData) {
  const user = await requireUser();
  const datasetId = formData.get("datasetId") as string;
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: { slug: true, siteId: true, site: { select: { slug: true } } },
  });
  if (!dataset || !(await canManageSite(dataset.siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }
  const path = `/datasets/${dataset!.site.slug}/${dataset!.slug}`;

  const name = (formData.get("name") as string | null)?.trim();
  const sourceType = formData.get("sourceType") as string | null;
  if (!name || !sourceType) {
    redirect(`${path}/edit?error=missing`);
  }

  await prisma.dataset.update({
    where: { id: datasetId },
    data: {
      name,
      abbreviation: (formData.get("abbreviation") as string) || null,
      sourceType: sourceType as never,
      careSetting: multi(formData, "careSetting") as never,
      therapeuticAreas: csv(formData, "therapeuticAreas"),
      sourceCodingSystems: csv(formData, "sourceCodingSystems"),
      description: (formData.get("description") as string) || null,
      visibility: ((formData.get("visibility") as string) || "PRIVATE") as never,
    },
  });

  revalidatePath(path);
  redirect(path);
}

// Freeze the current Dataset head (catalog metadata) into an immutable snapshot.
export async function publishDatasetVersion(formData: FormData) {
  const user = await requireUser();
  const datasetId = formData.get("datasetId") as string;
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: { site: { select: { slug: true } } },
  });
  if (!dataset || !(await canManageSite(dataset.siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }

  const last = await prisma.datasetVersion.findFirst({
    where: { datasetId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  await prisma.datasetVersion.create({
    data: {
      datasetId,
      versionNumber,
      name: dataset!.name,
      abbreviation: dataset!.abbreviation,
      sourceType: dataset!.sourceType,
      careSetting: dataset!.careSetting,
      therapeuticAreas: dataset!.therapeuticAreas,
      sourceCodingSystems: dataset!.sourceCodingSystems,
      description: dataset!.description,
      note: (formData.get("note") as string) || null,
      createdById: user.id,
    },
  });

  const path = `/datasets/${dataset!.site.slug}/${dataset!.slug}`;
  revalidatePath(path);
  redirect(`${path}/versions/${versionNumber}`);
}

// ── Dataset approval workflow ────────────────────────────────────────────────

export async function submitDatasetForApproval(formData: FormData) {
  const user = await requireUser();
  const datasetId = formData.get("datasetId") as string;
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: { slug: true, siteId: true, approvalStatus: true, site: { select: { slug: true } } },
  });
  if (!dataset || !(await canManageSite(dataset.siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }
  if (dataset!.approvalStatus === "DRAFT" || dataset!.approvalStatus === "REJECTED") {
    await prisma.dataset.update({
      where: { id: datasetId },
      data: { approvalStatus: "PENDING" as never, submittedAt: new Date(), reviewNote: null },
    });
  }
  const path = `/datasets/${dataset!.site.slug}/${dataset!.slug}`;
  revalidatePath(path);
  redirect(path);
}

export async function withdrawDataset(formData: FormData) {
  const user = await requireUser();
  const datasetId = formData.get("datasetId") as string;
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: { slug: true, siteId: true, approvalStatus: true, site: { select: { slug: true } } },
  });
  if (!dataset || !(await canManageSite(dataset.siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }
  if (dataset!.approvalStatus === "PENDING") {
    await prisma.dataset.update({
      where: { id: datasetId },
      data: { approvalStatus: "DRAFT" as never, submittedAt: null },
    });
  }
  const path = `/datasets/${dataset!.site.slug}/${dataset!.slug}`;
  revalidatePath(path);
  redirect(path);
}

// Coordinator/superuser decision. Reviewer must not own/be a member of the site.
export async function reviewDataset(formData: FormData) {
  const actor = await getCurrentUser();
  if (!canReview(actor.systemRole)) redirect("/dashboard?error=forbidden");

  const datasetId = formData.get("datasetId") as string;
  const decision = formData.get("decision") as string; // APPROVE | REJECT
  const note = (formData.get("note") as string) || null;

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      site: {
        select: {
          slug: true,
          ownerId: true,
          members: { where: { userId: actor.id }, select: { id: true } },
        },
      },
    },
  });
  if (!dataset) redirect("/review");
  if (dataset!.site.ownerId === actor.id || dataset!.site.members.length > 0) {
    redirect("/review?error=own");
  }
  if (dataset!.approvalStatus !== "PENDING") redirect("/review");

  await prisma.dataset.update({
    where: { id: datasetId },
    data: {
      approvalStatus: (decision === "APPROVE" ? "APPROVED" : "REJECTED") as never,
      reviewNote: decision === "REJECT" ? note : null,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });
  revalidatePath("/review");
  revalidatePath(`/datasets/${dataset!.site.slug}/${dataset!.slug}`);
  redirect("/review");
}

export async function addDatasetRelease(formData: FormData) {
  const user = await requireUser();

  const datasetId = formData.get("datasetId") as string | null;
  const label = (formData.get("label") as string | null)?.trim();
  if (!datasetId) redirect("/sites?error=forbidden");

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: { slug: true, siteId: true, site: { select: { slug: true } } },
  });
  if (!dataset || !(await canManageSite(dataset.siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }
  const path = `/datasets/${dataset!.site.slug}/${dataset!.slug}`;
  if (!label) {
    redirect(`${path}/releases/new?error=missing`);
  }

  const cdmVersion = (formData.get("cdmVersion") as string) || null;
  const toDate = (k: string) => {
    const v = formData.get(k) as string | null;
    return v ? new Date(v) : null;
  };

  await prisma.datasetRelease.create({
    data: {
      datasetId: datasetId as string,
      label,
      cdmSourceName: (formData.get("cdmSourceName") as string) || null,
      cdmSourceAbbreviation: (formData.get("cdmSourceAbbreviation") as string) || null,
      cdmHolder: (formData.get("cdmHolder") as string) || null,
      sourceDescription: (formData.get("sourceDescription") as string) || null,
      cdmEtlReference: (formData.get("cdmEtlReference") as string) || null,
      sourceReleaseDate: toDate("sourceReleaseDate"),
      cdmReleaseDate: toDate("cdmReleaseDate"),
      cdmVersion: cdmVersion as never,
      vocabularyVersion: (formData.get("vocabularyVersion") as string) || null,
      status: ((formData.get("status") as string) || "DRAFT") as never,
    },
  });

  revalidatePath(path);
  redirect(path);
}

// Toggle a dataset's visibility (owner/member only).
export async function setDatasetVisibility(formData: FormData) {
  const user = await requireUser();
  const datasetId = formData.get("datasetId") as string;
  const visibility = formData.get("visibility") as string;

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: { slug: true, siteId: true, site: { select: { slug: true } } },
  });
  if (!dataset || !(await canManageSite(dataset.siteId, user.id))) {
    redirect("/sites?error=forbidden");
  }

  await prisma.dataset.update({
    where: { id: datasetId },
    data: { visibility: visibility as never },
  });

  const path = `/datasets/${dataset!.site.slug}/${dataset!.slug}`;
  revalidatePath(path);
  redirect(path);
}
