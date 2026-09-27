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
    // If connection string contains unencoded special characters, pass raw to pg
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

  // Enforce TLS/SSL for Neon and cloud Postgres instances
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  return url.toString();
}

const prismaClientSingleton = () => {
  const connectionString = buildConnectionString();
  logger.info('[PRISMA] Initializing pooled Postgres connection via pg.Pool + @prisma/adapter-pg');

  // Explicit pg.Pool construction ensures connection timeouts and SSL are enforced
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    // Serverless-optimized settings: 5s connection timeout, max 2 connections per instance
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 2,
  });

  // Dynamic capability check for Vercel Fluid Compute database pool attachment.
  // Using dynamic lookup prevents compile-time TS2305 errors when @vercel/functions is pinned to v1.x.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vercelFunctions = require('@vercel/functions');
    if (typeof vercelFunctions.attachDatabasePool === 'function') {
      vercelFunctions.attachDatabasePool(pool);
    }
  } catch {
    // Graceful fallback when running in local development or older @vercel/functions versions
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