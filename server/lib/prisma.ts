import { PrismaNeonHttp } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

console.log('[DEBUG PRISMA] Initializing Stateless Prisma Neon HTTP Fetch Adapter...');

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  // Set up the Prisma 7 Neon HTTP stateless adapter (exactly 2 arguments required: connectionString, options)
  const adapter = new PrismaNeonHttp(connectionString, {});
  
  return new PrismaClient({
    adapter,
    log: ['query', 'error', 'warn'],
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