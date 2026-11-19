import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from '../config/logger';

export type DatabaseProviderName = 'supabase' | 'neon' | 'postgres';

function isSupabaseUrl(raw: string): boolean {
  const lower = raw.toLowerCase();
  return lower.includes('supabase.co') || lower.includes('supabase.com');
}

function isNeonUrl(raw: string): boolean {
  return raw.toLowerCase().includes('.neon.tech');
}

function buildConnectionString(): {
  connectionString: string;
  provider: DatabaseProviderName;
  host: string;
} {
  const candidates = [
    process.env.DATABASE_URL_POOLED,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  if (candidates.length === 0) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  // Prefer Supabase over stale Neon env vars (e.g., old Vercel Storage DATABASE_URL_POOLED)
  const supabaseCandidate = candidates.find(isSupabaseUrl);
  let raw = supabaseCandidate || candidates[0];

  if (supabaseCandidate && candidates[0] && isNeonUrl(candidates[0])) {
    logger.warn(
      '[PRISMA] Ignoring stale Neon DATABASE_URL_POOLED/POSTGRES_URL because a Supabase connection string is present. Clean up old Neon env vars in Vercel.'
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { connectionString: raw, provider: 'postgres', host: 'unknown' };
  }

  const host = url.hostname.toLowerCase();
  const isSupabase = isSupabaseUrl(host);
  const isNeon = isNeonUrl(host);

  // Inject '-pooler' strictly for Neon endpoints if not already pooled
  if (isNeon && !host.includes('-pooler')) {
    const parts = url.hostname.split('.');
    parts[0] = `${parts[0]}-pooler`;
    url.hostname = parts.join('.');
  }

  // Strip query parameters unrecognized by node-postgres pg.Pool
  url.searchParams.delete('connect_timeout');
  url.searchParams.delete('pool_timeout');
  url.searchParams.delete('pgbouncer');
  url.searchParams.delete('supa');

  if (isNeon && !url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return {
    connectionString: url.toString(),
    provider: isSupabase ? 'supabase' : isNeon ? 'neon' : 'postgres',
    host: url.hostname,
  };
}

const resolvedDb = buildConnectionString();
export const activeDbProvider: DatabaseProviderName = resolvedDb.provider;
export const activeDbHost: string = resolvedDb.host;

const prismaClientSingleton = () => {
  logger.info(
    `[PRISMA] Initializing pooled Postgres connection (${resolvedDb.provider} @ ${resolvedDb.host}) via pg.Pool + @prisma/adapter-pg`
  );

  const pool = new Pool({
    connectionString: resolvedDb.connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 6_000,
    idleTimeoutMillis: 10_000,
    max: 2,
  });

  pool.on('error', (err) => {
    logger.error({ err: err?.message }, '[PRISMA] Unexpected idle PostgreSQL pool error');
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vercelFunctions = require('@vercel/functions');
    if (typeof vercelFunctions.attachDatabasePool === 'function') {
      vercelFunctions.attachDatabasePool(pool);
    }
  } catch {}

  const adapter = new PrismaPg(pool);

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