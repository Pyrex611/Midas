import "dotenv/config";
import { defineConfig } from "prisma/config";

let directUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_POOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!directUrl) {
  throw new Error(
    "Set POSTGRES_URL_NON_POOLING or DATABASE_URL before running Prisma CLI commands."
  );
}

// Supavisor Transaction Mode (:6543) hangs `prisma db push` / `prisma migrate`
// indefinitely because DDL advisory locks require Session Mode (:5432).
try {
  const parsed = new URL(directUrl);
  if (
    (parsed.hostname.includes("pooler.supabase.com") || parsed.hostname.includes("pooler.supabase.co")) &&
    parsed.port === "6543"
  ) {
    parsed.port = "5432";
    directUrl = parsed.toString();
  }
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});