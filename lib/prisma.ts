import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Use Neon's POOLED (Supavisor-style, port 5432 pooler) connection string here —
// NOT the HTTP-driver connection string. This is the actual fix for the
// prior 300s timeout: standard TCP + node-postgres has real connection-level
// timeouts instead of the HTTP driver's un-timed fetch.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString,
  // node-postgres has NO default connection timeout (v7 changed this from
  // Prisma's old 5s default) — set these explicitly or you reintroduce the
  // exact class of bug we just fixed, via a different driver.
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  max: 10, // cap pool size per serverless instance — Neon pooler has its own upstream limit
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}