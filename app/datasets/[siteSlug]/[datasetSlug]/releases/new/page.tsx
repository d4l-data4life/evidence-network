import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { addDatasetRelease } from "@/app/sites/actions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { Field, TextInput, TextArea, Select, SubmitButton } from "@/app/_components/form";
import { CDM_VERSION, DATASET_RELEASE_STATUS } from "@/lib/labels";

export default async function NewDatasetReleasePage({
  params,
  searchParams,
}: PageProps<"/datasets/[siteSlug]/[datasetSlug]/releases/new">) {
  const user = await requireUser();
  const t = await getTranslations("datasets");
  const tf = await getTranslations("datasets.releaseForm");
  const tl = await getTranslations("labels");
  const { siteSlug, datasetSlug } = await params;
  const sp = await searchParams;

  const dataset = await prisma.dataset.findFirst({
    where: { slug: datasetSlug, site: { slug: siteSlug } },
    select: {
      id: true,
      name: true,
      slug: true,
      site: {
        select: {
          slug: true,
          ownerId: true,
          members: { where: { userId: user.id }, select: { id: true } },
        },
      },
    },
  });
  const canManage =
    !!dataset &&
    (dataset.site.ownerId === user.id || dataset.site.members.length > 0);
  if (!dataset || !canManage) notFound();

  const base = `/datasets/${dataset.site.slug}/${dataset.slug}`;

  return (
    <PageContainer>
      <PageHeader
        title={t("addReleaseTitle")}
        subtitle={t("addReleaseSubtitle", { name: dataset.name })}
        back={{ href: base, label: dataset.name }}
      />

      {sp.error === "missing" && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorReleaseLabel")}
        </p>
      )}

      <form action={addDatasetRelease} className="flex flex-col gap-4">
        <input type="hidden" name="datasetId" value={dataset.id} />

        <Field label={tf("label")} hint={tf("labelHint")}>
          <TextInput name="label" required placeholder="2024-Q1" />
        </Field>
        <Field label={tf("cdmSourceName")} hint={tf("cdmSourceNameHint")}>
          <TextInput name="cdmSourceName" />
        </Field>
        <Field label={tf("cdmSourceAbbreviation")}>
          <TextInput name="cdmSourceAbbreviation" />
        </Field>
        <Field label={tf("cdmHolder")}>
          <TextInput name="cdmHolder" />
        </Field>
        <Field label={tf("cdmVersion")}>
          <Select name="cdmVersion" options={CDM_VERSION} />
        </Field>
        <Field label={tf("vocabularyVersion")} hint={tf("vocabularyVersionHint")}>
          <TextInput name="vocabularyVersion" />
        </Field>
        <Field label={tf("sourceReleaseDate")} hint={tf("sourceReleaseDateHint")}>
          <TextInput name="sourceReleaseDate" type="date" />
        </Field>
        <Field label={tf("cdmReleaseDate")} hint={tf("cdmReleaseDateHint")}>
          <TextInput name="cdmReleaseDate" type="date" />
        </Field>
        <Field label={tf("etlReference")} hint={tf("etlReferenceHint")}>
          <TextInput name="cdmEtlReference" />
        </Field>
        <Field label={tf("sourceDescription")}>
          <TextArea name="sourceDescription" />
        </Field>
        <Field label={tf("status")}>
          <Select
            name="status"
            options={DATASET_RELEASE_STATUS.map((o) => ({ value: o.value, label: tl(`datasetReleaseStatus.${o.value}`) }))}
            defaultValue="DRAFT"
            required
          />
        </Field>

        <SubmitButton>{t("addRelease")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
