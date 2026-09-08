// Locale constants — safe to import from both client and server code (no DB,
// no auth). The set of SUPPORTED locales is fixed by which message catalogs
// exist under /messages. Which of them are actually OFFERED in the language
// switcher is a per-deployment setting (Setting.enabledLocales).

export const LOCALES = ["en", "pt-BR", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Native-language labels for the switcher.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
  es: "Español",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Narrow an arbitrary list to supported locales, preserving order. */
export function asLocales(values: readonly string[] | null | undefined): Locale[] {
  if (!values) return [];
  return values.filter(isLocale);
}
