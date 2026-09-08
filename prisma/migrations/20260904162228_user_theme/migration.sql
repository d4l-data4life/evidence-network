-- Per-user preferred color theme (null = follow system/OS).
-- Stored per-user so the theme does not leak across accounts on a shared browser.
ALTER TABLE "User" ADD COLUMN "theme" TEXT;
