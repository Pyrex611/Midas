import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from '../config/logger';

function buildConnectionString(): string {
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
    return raw;
  }

  // Universal Neon Pooler Injection:
  // If the host belongs to neon.tech and does not already include '-pooler',
  // inject '-pooler' into the primary endpoint identifier.
  if (url.hostname.includes('.neon.tech') && !url.hostname.includes('-pooler')) {
    const parts = url.hostname.split('.');
    parts[0] = `${parts[0]}-pooler`;
    url.hostname = parts.join('.');
  }

  // Clean obsolete query parameters not recognized by node-postgres
  url.searchParams.delete('connect_timeout');
  url.searchParams.delete('pool_timeout');
  url.searchParams.delete('pgbouncer');

  // Enforce TLS/SSL verify-full for Neon to silence pg-connection-string warning
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return url.toString();
}

const prismaClientSingleton = () => {
  const connectionString = buildConnectionString();
  logger.info('[PRISMA] Initializing pooled Postgres connection via pg.Pool + @prisma/adapter-pg');

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 2,
  });

  // Dynamic capability check for Vercel Fluid Compute database pool attachment
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vercelFunctions = require('@vercel/functions');
    if (typeof vercelFunctions.attachDatabasePool === 'function') {
      vercelFunctions.attachDatabasePool(pool);
    }
  } catch {
    // Graceful fallback
  }

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