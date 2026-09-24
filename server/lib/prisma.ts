import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

/**
 * DEFINITIVE FIX for the site-wide "every page hangs for exactly 300s, zero
 * errors" incident.
 *
 * Root cause: this file previously used `PrismaNeonHttp` (from
 * `@prisma/adapter-neon`), which issues a plain `fetch()` per query against
 * Neon's HTTP data-API endpoint with NO configurable timeout anywhere in
 * the chain. If that endpoint is slow to respond, unreachable, or the
 * underlying Neon compute is failing to wake from suspend, the fetch simply
 * hangs — Node has no default fetch timeout, so nothing ever errors, and
 * the request just sits until Vercel's own hard 300s ceiling kills the
 * function. That explains why it was uniform across every route (all of
 * them go through this same client) and silent (no exception is ever
 * thrown — there's simply nothing to catch).
 *
 * `PrismaNeonHttp` also exists specifically for Edge runtimes (Cloudflare
 * Workers, Vercel Edge Functions) that have no raw TCP socket access at
 * all. This project's API runs as a standard Node.js serverless function
 * (`api/index.ts` via `serverless-http` + Express) — real TCP sockets are
 * available here, so the HTTP-only adapter was never actually necessary;
 * it was solving a problem this deployment doesn't have, while introducing
 * the fragility above.
 *
 * The fix: a standard pooled Postgres connection (Neon's PgBouncer-backed
 * `-pooler` endpoint, the setup Neon recommends for serverless) with
 * explicit `connect_timeout`/`pool_timeout` parameters. This uses Prisma's
 * own connection engine, which enforces real, well-defined TCP-level
 * timeouts — an unreachable database now fails in ~10 seconds with a clear
 * "can't reach database" error instead of hanging silently for 5 minutes.
 *
 * Requires `prisma/schema.prisma`'s datasource block to declare
 * `url = env("DATABASE_URL")` (the previous adapter-only setup omitted
 * this, since PrismaNeonHttp supplied the connection itself at runtime).
 */
function buildConnectionString(): string {
  const raw = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || '';
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
  // from separate function invocations. (The old HTTP-adapter code stripped
  // "-pooler" deliberately, because that adapter bypassed traditional
  // pooling entirely; a standard TCP connection wants the opposite.)
  if (/\.neon\.tech$/i.test(url.hostname) && !url.hostname.includes('-pooler.')) {
    url.hostname = url.hostname.replace(/(\.[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech)$/i, '-pooler$1');
  }

  // Force fast, well-defined failures instead of indefinite hangs. These
  // are the actual fix for the incident: a DB that's unreachable now errors
  // in ~10s instead of hanging until Vercel's 300s hard limit.
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '10');
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '10');
  // Required when connecting through PgBouncer's pooled endpoint.
  if (!url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');

  return url.toString();
}

const prismaClientSingleton = () => {
  const connectionString = buildConnectionString();
  logger.info('[DEBUG PRISMA] Initializing standard pooled Postgres connection (10s connect/pool timeout)...');

  return new PrismaClient({
    datasourceUrl: connectionString,
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
