"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setTheme } from "@/app/account/actions";

type Pref = "light" | "system" | "dark";

const OPTIONS: { key: Pref; icon: string }[] = [
  { key: "light", icon: "☀" },
  { key: "system", icon: "🖥" },
  { key: "dark", icon: "☾" },
];

// Apply the choice immediately (optimistic) by mirroring what the root-layout
// inline script does: set the pref attribute + toggle the `dark` class. The
// authoritative value is then persisted to the user's profile via setTheme.
function applyTheme(pref: Pref) {
  const el = document.documentElement;
  el.setAttribute("data-theme-pref", pref);
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.classList.toggle("dark", dark);
}

export function ThemeToggle({ current }: { current: Pref }) {
  const t = useTranslations("theme");
  const [pref, setPref] = useState<Pref>(current);
  const [, startTransition] = useTransition();

  function choose(next: Pref) {
    setPref(next);
    applyTheme(next);
    startTransition(() => {
      void setTheme(next);
    });
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex rounded-full border border-black/15 dark:border-white/20 p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = pref === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => choose(o.key)}
            className={
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition " +
              (active
                ? "bg-foreground text-background"
                : "text-black/60 dark:text-white/60 hover:text-foreground")
            }
          >
            <span aria-hidden>{o.icon}</span>
            {t(o.key)}
          </button>
        );
      })}
    </div>
  );
}
