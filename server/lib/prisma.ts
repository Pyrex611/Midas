import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../config/logger';

/**
 * DEFINITIVE FIX, PART 2 — the incident this file's previous version
 * describes (PrismaNeonHttp's unbounded fetch causing the site-wide 300s
 * hang) was correctly diagnosed and correctly fixed for Prisma 6.x, using
 * `new PrismaClient({ datasourceUrl: ... })` with a pooled connection
 * string plus connect/pool timeout query params.
 *
 * That fix silently broke when this project upgraded to Prisma 7
 * (`@prisma/client` / `prisma` are both pinned to ^7.9.1 in package.json,
 * and `@prisma/adapter-pg` + `pg` are already installed there too — the
 * pieces for the real fix were already present, just not wired up here).
 * Prisma 7.0.0 REMOVED the `datasourceUrl` and `datasources` constructor
 * options entirely — `new PrismaClient({ datasourceUrl })` now throws
 * `PrismaClientConstructorValidationError: Using engine type "client"
 * requires either "adapter" or "accelerateUrl"` the instant this module
 * loads. Every controller/service in this codebase imports the default
 * export of this exact file, so that error takes down the entire API.
 *
 * The fix: pass a `@prisma/adapter-pg` driver adapter instead. This is the
 * officially-supported v7 replacement for a direct TCP Postgres
 * connection and keeps every property of the original fix — real,
 * well-defined TCP-level connect/idle timeouts (now set as Pool options,
 * since node-postgres does not read Prisma's old
 * connect_timeout/pool_timeout/pgbouncer query-string params) — while
 * satisfying v7's adapter requirement.
 *
 * Requires `prisma/schema.prisma`'s datasource block to declare ONLY
 * `provider = "postgresql"` — Prisma 7 rejects a `url` property in the
 * schema file outright (this is the P1012 "datasource property `url` is
 * no longer supported" error); the connection string lives here and in
 * `prisma.config.ts` (CLI-only) instead.
 */
function buildConnectionString(): string {
  // This project's Neon-via-Vercel integration provides all four of these;
  // DATABASE_URL_POOLED and DATABASE_URL are both expected to already be
  // the pooled string, POSTGRES_URL is Vercel's own alias for the same —
  // checked in this order for robustness in case any one of them is ever
  // repointed. POSTGRES_URL_NON_POOLING (the direct string) is deliberately
  // NOT a candidate here — that one belongs to prisma.config.ts's CLI-only
  // connection, never to this runtime client.
  const raw =
    process.env.DATABASE_URL_POOLED ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '';
  if (!raw) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Malformed URL — let Prisma's own connection attempt surface a clear error.
    return raw;
  }

  // Use Neon's POOLED (PgBouncer) endpoint — the standard, serverless-
  // friendly setup for a deployment shape with many short-lived connections
  // from separate function invocations.
  if (/\.neon\.tech$/i.test(url.hostname) && !url.hostname.includes('-pooler.')) {
    url.hostname = url.hostname.replace(/(\.[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech)$/i, '-pooler$1');
  }

  // `connect_timeout` / `pool_timeout` / `pgbouncer` were Prisma's own
  // Rust-query-engine URL params. The `pg` driver adapter used below talks
  // to Postgres directly via node-postgres, which does not read these from
  // the URL at all — silently ignoring them would give a false sense that
  // a timeout is configured when it isn't. Real timeouts are set as
  // explicit Pool options below instead. Neon's pooler (PgBouncer 1.22+)
  // supports protocol-level prepared statements natively, so no
  // `pgbouncer=true` compatibility flag is needed with node-postgres either.
  url.searchParams.delete('connect_timeout');
  url.searchParams.delete('pool_timeout');
  url.searchParams.delete('pgbouncer');

  return url.toString();
}

const prismaClientSingleton = () => {
  const connectionString = buildConnectionString();
  logger.info(
    '[DEBUG PRISMA] Initializing pooled Postgres connection via @prisma/adapter-pg ' +
    '(10s connect timeout, 30s idle timeout)...'
  );

  const adapter = new PrismaPg({
    connectionString,
    // The actual fix for the 300s-hang incident, carried over from the
    // previous version of this file: an unreachable/slow database now
    // fails in ~10s with a clear connection error instead of hanging
    // until Vercel's hard 300s ceiling kills the function.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    // Cap pool size PER serverless instance — Neon's pooler enforces its
    // own upstream connection ceiling across all concurrent invocations;
    // an unbounded per-instance pool here would exhaust it under load.
    max: 10,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'query'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}
