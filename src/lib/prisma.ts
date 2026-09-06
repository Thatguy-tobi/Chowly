import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

/**
 * Prisma client, shared across the application.
 *
 * From Prisma 7 the client connects through a driver adapter rather than a URL
 * declared in the schema. The Neon adapter is used here because the application
 * runs on Vercel as serverless functions: each request can be handled by a
 * fresh instance, and a conventional connection pool would exhaust the
 * database's connection limit under load. DATABASE_URL points at Neon's pooled
 * endpoint; migrations use DIRECT_URL instead (see prisma.config.ts).
 *
 * In development Next.js reloads modules on every edit, which would create a
 * new client — and a new pool — each time. Caching it on globalThis keeps a
 * single client across reloads.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in your Neon connection strings."
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
