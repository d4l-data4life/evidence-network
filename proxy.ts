// Route-protection proxy (Next.js 16's renamed "middleware"). Runs the
// edge-safe authConfig (JWT-only, no Prisma/bcrypt) so the `authorized`
// callback can redirect logged-out users away from /dashboard. The matcher
// limits it to the protected path.

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/studies/:path*",
    "/sites/:path*",
    "/datasets/:path*",
    "/review/:path*",
    "/admin/:path*",
  ],
};
