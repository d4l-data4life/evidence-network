import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createDataset } from "@/app/sites/actions";
import { DatasetFields } from "../dataset-fields";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/form";

export default async function NewDatasetPage({
  searchParams,
}: PageProps<"/datasets/new">) {
  const user = await requireUser();
  const t = await getTranslations("datasets");
  const params = await searchParams;
  const siteId = typeof params.siteId === "string" ? params.siteId : undefined;
  if (!siteId) notFound();

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      legalName: true,
      slug: true,
      ownerId: true,
      members: { where: { userId: user.id }, select: { id: true } },
    },
  });
  const canManage =
    !!site && (site.ownerId === user.id || site.members.length > 0);
  if (!site || !canManage) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={t("addTitle")}
        subtitle={t("addSubtitle", { site: site.legalName })}
        back={{ href: `/sites/${site.slug}`, label: site.legalName }}
      />

      {params.error === "missing" && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorMissing")}
        </p>
      )}

      <form action={createDataset} className="flex flex-col gap-4">
        <input type="hidden" name="siteId" value={siteId} />
        <DatasetFields />
        <SubmitButton>{t("addDataset")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
