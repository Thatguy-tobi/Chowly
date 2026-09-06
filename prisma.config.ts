// Prisma 7 no longer loads .env automatically, so it is loaded explicitly here.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * From version 7 the connection URL is no longer declared in schema.prisma.
 * Migration and introspection commands read it from here; the running
 * application connects through a driver adapter instead (src/lib/prisma.ts).
 *
 * Migrations use DIRECT_URL rather than the pooled endpoint, because schema
 * changes cannot be applied through a connection pooler.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
