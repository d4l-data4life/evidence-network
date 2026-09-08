import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a small Docker
  // runtime image.
  output: "standalone",
};

export default withNextIntl(nextConfig);
