// Auth.js (NextAuth v5) configuration.
//
// Two sign-in paths:
//   1. Credentials  — local username/password checked against the User table.
//   2. ORCID (OIDC) — federated login via sandbox.orcid.org / orcid.org.
//
// Because a Credentials provider is present, the session strategy MUST be "jwt"
// (database sessions are incompatible with Credentials in Auth.js v5). The
// PrismaAdapter is still attached so ORCID sign-ins persist linked User/Account
// rows; Credentials-authenticated users are looked up manually in authorize().

import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// ORCID's OIDC `sub` claim is the ORCID iD; it returns no email.
interface OrcidProfile {
  sub: string;
  given_name?: string;
  family_name?: string;
  name?: string;
}

// Surface the login method + user id on the session for the dashboard to show.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      provider?: string;
      orcidId?: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  debug: process.env.AUTH_DEBUG === "true",
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Username and password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          orcidId: user.orcidId,
        };
      },
    }),
    {
      id: "orcid",
      name: "ORCID",
      type: "oidc",
      issuer: process.env.ORCID_ISSUER, // https://sandbox.orcid.org or https://orcid.org
      clientId: process.env.ORCID_CLIENT_ID,
      clientSecret: process.env.ORCID_CLIENT_SECRET,
      authorization: { params: { scope: "openid" } },
      // ORCID advertises only client_secret_post for token endpoint auth.
      client: { token_endpoint_auth_method: "client_secret_post" },
      checks: ["pkce", "state"],
      // Host note: the app is served on the loopback hostname `evidence.test`
      // (mapped to 127.0.0.1 via /etc/hosts; `.test` is RFC 6761-reserved). This
      // deliberately sidesteps a conflict between ORCID and Next.js: the ORCID
      // sandbox rejects the literal host "localhost" as a redirect URI, while
      // Next.js's NextRequest rewrites the loopback IP 127.0.0.1 -> localhost
      // internally. A custom host is accepted by ORCID (not "localhost") and left
      // untouched by Next, so the browser host, the state/PKCE cookie host, the
      // emitted redirect_uri, and the callback host are all consistent — no
      // redirectProxyUrl workaround needed. Just set AUTH_URL=http://evidence.test:3000.
      profile(profile: OrcidProfile) {
        const name =
          profile.name ??
          `${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim();
        return {
          id: profile.sub,
          name: name || profile.sub,
          orcidId: profile.sub,
        };
      },
    },
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Persist id / provider / orcidId into the JWT, then expose on the session.
    async jwt({ token, user, account }) {
      if (user) {
        token.uid = user.id;
        // ORCID's profile() returns orcidId; credentials returns it from the DB.
        token.orcidId = (user as { orcidId?: string | null }).orcidId ?? null;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? token.sub!;
        session.user.provider = token.provider as string | undefined;
        session.user.orcidId = (token.orcidId as string | null) ?? null;
      }
      return session;
    },
  },
});
