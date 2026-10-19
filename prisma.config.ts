import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 CLI operations (generate, migrate deploy/dev) read their
// connection string from here, never from schema.prisma (see P1012 fix).
//
// Prefer the DIRECT (non-pooled) connection for CLI/Migrate operations —
// DDL and Prisma Migrate's own locking behavior are safer off PgBouncer's
// transaction-mode pooling. This project's Neon-via-Vercel integration
// injects POSTGRES_URL_NON_POOLING for exactly this; DIRECT_URL is checked
// too in case that's ever set instead/later. Falls through to whatever
// pooled string exists rather than hard-blocking a setup with only one
// connection string configured — but POSTGRES_URL_NON_POOLING being unset
// here would be worth investigating, not just silently tolerating.
const directUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_POOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!directUrl) {
  throw new Error(
    "Set POSTGRES_URL_NON_POOLING (preferred, Neon-via-Vercel's direct connection string) " +
    "before running Prisma CLI commands."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});
