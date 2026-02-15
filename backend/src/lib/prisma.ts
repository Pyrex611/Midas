import { PrismaClient } from '@prisma/client';

// Global singleton – guaranteed single instance across all imports
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({});
//   log: ['query', 'info', 'warn', 'error'], // 🔥 ENABLE FULL LOGGING
// });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;