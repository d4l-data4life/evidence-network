// Prisma 7 client singleton.
//
// The Rust-free `prisma-client` generator requires a driver adapter at runtime;
// for PostgreSQL that's `@prisma/adapter-pg` wrapping the `pg` driver. We cache
// the instance on `globalThis` in development so Next.js hot-reloads don't open
// a new connection pool on every change.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
