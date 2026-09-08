import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { updateDataset } from "@/app/sites/actions";
import { DatasetFields } from "../../../dataset-fields";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/form";

export default async function EditDatasetPage({
  params,
  searchParams,
}: PageProps<"/datasets/[siteSlug]/[datasetSlug]/edit">) {
  const user = await requireUser();
  const t = await getTranslations("datasets");
  const { siteSlug, datasetSlug } = await params;
  const sp = await searchParams;

  const dataset = await prisma.dataset.findFirst({
    where: { slug: datasetSlug, site: { slug: siteSlug } },
    include: {
      site: {
        select: {
          slug: true,
          ownerId: true,
          members: { where: { userId: user.id }, select: { id: true } },
        },
      },
    },
  });
  if (!dataset) notFound();
  const canManage =
    dataset.site.ownerId === user.id || dataset.site.members.length > 0;
  if (!canManage) notFound();

  const base = `/datasets/${dataset.site.slug}/${dataset.slug}`;

  return (
    <PageContainer>
      <PageHeader
        title={t("editTitle")}
        subtitle={t("editSubtitle")}
        back={{ href: base, label: dataset.name }}
      />

      {sp.error === "missing" && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorMissing")}
        </p>
      )}

      <form action={updateDataset} className="flex flex-col gap-4">
        <input type="hidden" name="datasetId" value={dataset.id} />
        <DatasetFields
          dataset={{
            name: dataset.name,
            abbreviation: dataset.abbreviation,
            sourceType: dataset.sourceType,
            careSetting: dataset.careSetting,
            therapeuticAreas: dataset.therapeuticAreas,
            sourceCodingSystems: dataset.sourceCodingSystems,
            description: dataset.description,
            visibility: dataset.visibility,
          }}
        />
        <SubmitButton>{t("saveChanges")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
