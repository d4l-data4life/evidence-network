// Edge-safe Auth.js config shared between middleware and the full server config.
//
// This file must NOT import Prisma, bcrypt, or anything Node-only, because
// middleware.ts runs it in the Edge runtime. It holds only the route-protection
// logic (`authorized`) and the custom sign-in page; the real providers and the
// Prisma adapter are added in auth.ts.

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [], // real providers are added in auth.ts
  callbacks: {
    // Gate the authenticated area: logged-out users are redirected to sign-in.
    // Everything in the network requires a session — "public" visibility
    // still means "any authenticated user", never anonymous access.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = [
        "/dashboard",
        "/account",
        "/studies",
        "/sites",
        "/datasets",
        "/review",
        "/admin",
      ];
      const isProtected = protectedPrefixes.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + "/"),
      );
      if (isProtected) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
