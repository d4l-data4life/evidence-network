-- Per-user preferred UI language (null = follow the system default locale).
ALTER TABLE "User" ADD COLUMN "locale" TEXT;

-- System-wide i18n settings on the branding singleton.
ALTER TABLE "Setting" ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Setting" ADD COLUMN "enabledLocales" TEXT[] NOT NULL DEFAULT ARRAY['en', 'pt-BR', 'es']::TEXT[];
