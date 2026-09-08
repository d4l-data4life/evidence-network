import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { updateSite } from "../../actions";
import { SiteFields } from "../../site-fields";
import { PageContainer, PageHeader } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/form";

export default async function EditSitePage({
  params,
  searchParams,
}: PageProps<"/sites/[slug]/edit">) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations("sites");

  const site = await prisma.site.findUnique({
    where: { slug },
    include: { members: { where: { userId: user.id }, select: { id: true } } },
  });
  if (!site) notFound();
  const canManage = site.ownerId === user.id || site.members.length > 0;
  if (!canManage) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={t("editTitle")}
        subtitle={t("editSubtitle")}
        back={{ href: `/sites/${site.slug}`, label: site.legalName }}
      />

      {sp.error === "missing" && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {t("errorMissing")}
        </p>
      )}

      <form action={updateSite} className="flex flex-col gap-4">
        <input type="hidden" name="siteId" value={site.id} />
        <SiteFields
          site={{
            legalName: site.legalName,
            abbreviation: site.abbreviation,
            country: site.country,
            orgType: site.orgType,
            description: site.description,
            website: site.website,
            governancePolicy: site.governancePolicy,
          }}
        />
        <SubmitButton>{t("saveChanges")}</SubmitButton>
      </form>
    </PageContainer>
  );
}
