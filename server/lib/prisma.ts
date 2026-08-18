import { PrismaNeonHttp } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

console.log('[DEBUG PRISMA] Initializing Neon HTTP Query Driver...');

const prismaClientSingleton = () => {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  // Ensure connection URL targets the direct compute endpoint for HTTP queries
  connectionString = connectionString.replace(/-pooler(\.[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech)/gi, '$1');
  connectionString = connectionString.replace(/&?channel_binding=[^&]*/g, '');
  connectionString = connectionString.replace(/&?pgbouncer=[^&]*/g, '');
  connectionString = connectionString.replace(/&?connection_limit=[^&]*/g, '');
  connectionString = connectionString.replace(/\?&/, '?').replace(/\?$/, '').trim();

  const adapter = new PrismaNeonHttp(connectionString, {});

  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}