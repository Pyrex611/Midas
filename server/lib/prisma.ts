import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from '../config/logger';

function buildConnectionString(): { connectionString: string; provider: 'supabase' | 'neon' | 'postgres' } {
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
    return { connectionString: raw, provider: 'postgres' };
  }

  const host = url.hostname.toLowerCase();
  const isSupabase = host.includes('supabase.co') || host.includes('supabase.com');
  const isNeon = host.includes('.neon.tech');

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

  if (isNeon && !url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return {
    connectionString: url.toString(),
    provider: isSupabase ? 'supabase' : isNeon ? 'neon' : 'postgres',
  };
}

const prismaClientSingleton = () => {
  const { connectionString, provider } = buildConnectionString();
  logger.info(`[PRISMA] Initializing pooled Postgres connection (${provider}) via pg.Pool + @prisma/adapter-pg`);

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 6_000,
    idleTimeoutMillis: 10_000,
    max: 2,
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