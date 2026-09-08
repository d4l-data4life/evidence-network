import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { getBranding } from "@/lib/settings";
import { resolveTheme } from "@/lib/theme";
import "./globals.css";

// Resolves the "system" theme before paint (no flash). The user's stored
// preference is on <html data-theme-pref>; explicit light/dark are already
// applied server-side (class on <html>), so this script only computes the
// "system" case from prefers-color-scheme and keeps it live. No localStorage —
// the preference is per-user (DB), not per-browser.
const themeInit = `
(function(){
  try {
    var el = document.documentElement;
    var pref = el.getAttribute('data-theme-pref') || 'system';
    var apply = function(){
      var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      el.classList.toggle('dark', dark);
    };
    apply();
    if (pref === 'system') {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
    }
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  return {
    title: b.tagline ? `${b.appName} — ${b.tagline}` : b.appName,
    description: b.landingIntro || undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Locale + theme are resolved per request from the user's stored preferences.
  const locale = await getLocale();
  const theme = await resolveTheme();

  return (
    <html
      lang={locale}
      data-theme-pref={theme}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${theme === "dark" ? " dark" : ""}`}
    >
      <body className="min-h-full flex flex-col">
        {/* Set the theme class before content paints (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
