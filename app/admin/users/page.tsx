import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSuperuser } from "@/lib/rbac";
import { setUserRole } from "../actions";
import { PageContainer, PageHeader, Card } from "@/app/_components/ui";
import { Select } from "@/app/_components/form";

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const actor = await requireSuperuser();
  const sp = await searchParams;
  const t = await getTranslations("adminUsers");
  const tc = await getTranslations("common");
  const tl = await getTranslations("labels");
  const tb = await getTranslations("admin.branding");

  const roleOptions = ["USER", "COORDINATOR", "SUPERUSER"].map((r) => ({
    value: r,
    label: tl(`systemRole.${r}`),
  }));

  const users = await prisma.user.findMany({
    orderBy: [{ systemRole: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, username: true, email: true, orcidId: true, systemRole: true },
  });

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back={{ href: "/admin/branding", label: tb("title") }}
      />

      {sp.error === "self" && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {t("errorSelf")}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <Card key={u.id}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {u.name ?? u.username ?? u.orcidId ?? tc("unknown")}
                  {u.id === actor.id && <span className="text-black/40 dark:text-white/40"> {t("you")}</span>}
                </span>
                <span className="text-xs text-black/45 dark:text-white/45">
                  {u.username ? `@${u.username}` : u.orcidId ? `ORCID ${u.orcidId}` : u.email ?? tc("none")}
                </span>
              </div>
              <form action={setUserRole} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <Select name="role" options={roleOptions} defaultValue={u.systemRole} required />
                <button type="submit" className="rounded-full border border-black/15 dark:border-white/25 px-4 py-1.5 text-xs font-medium hover:border-foreground transition">
                  {tc("save")}
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-black/45 dark:text-white/45">
        {t("note")}
      </p>
    </PageContainer>
  );
}
