import prisma from './prisma';
import { logger } from '../config/logger';

const STALE_LOCK_MINUTES = 10;

export type CronJobName = 'queue' | 'leads' | 'followups' | 'newsletter';

export async function acquireCronLock(name: CronJobName): Promise<boolean> {
  try {
    await prisma.cronLock.upsert({ where: { name }, update: {}, create: { name } });

    const claimed = await prisma.$executeRaw`
      UPDATE "CronLock"
      SET "locked_at" = NOW()
      WHERE name = ${name}
      AND ("locked_at" IS NULL OR "locked_at" < NOW() - INTERVAL '1 minute' * ${STALE_LOCK_MINUTES})
    `;

    return claimed > 0;
  } catch (error) {
    logger.error({ error, name }, 'Failed to acquire cron lock — proceeding without it');
    return true;
  }
}

export async function releaseCronLock(name: CronJobName): Promise<void> {
  try {
    await prisma.cronLock.update({ where: { name }, data: { lockedAt: null } });
  } catch (error) {
    logger.error({ error, name }, 'Failed to release cron lock');
  }
}

export async function withCronLock<T>(name: CronJobName, fn: () => Promise<T>): Promise<T | { skipped: true }> {
  const claimed = await acquireCronLock(name);
  if (!claimed) {
    logger.info({ name }, 'Cron job already running on another instance — skipping');
    return { skipped: true };
  }
  try {
    return await fn();
  } finally {
    await releaseCronLock(name);
  }
}