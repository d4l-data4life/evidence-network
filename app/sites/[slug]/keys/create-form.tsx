"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createApiKey } from "@/app/sites/actions";

// Mirrors the action's return shape (the action's type isn't exported from the
// "use server" module, which may only export async functions).
type State = {
  ok: boolean;
  error?: "forbidden" | "name";
  secret?: string;
  prefix?: string;
  name?: string;
};
const INITIAL: State = { ok: false };

export function CreateApiKeyForm({ siteId, slug }: { siteId: string; slug: string }) {
  const t = useTranslations("sites.keys");
  const [state, formAction, pending] = useActionState(createApiKey, INITIAL);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="slug" value={slug} />
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{t("nameLabel")}</span>
          <input
            name="name"
            required
            placeholder={t("namePlaceholder")}
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {t("create")}
        </button>
      </form>

      {state.error === "name" && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {t("errorName")}
        </p>
      )}
      {state.error === "forbidden" && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {t("errorForbidden")}
        </p>
      )}

      {state.ok && state.secret && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#A6CE39] bg-[#A6CE39]/10 p-3">
          <div className="text-sm font-semibold">{t("revealTitle")}</div>
          <div className="text-xs text-black/60 dark:text-white/60">{t("revealHint")}</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-black/5 dark:bg-white/10 px-2 py-1 font-mono text-xs">
              {state.secret}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(state.secret ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-full border border-black/20 dark:border-white/25 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
