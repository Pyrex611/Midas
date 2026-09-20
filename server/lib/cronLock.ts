import prisma from './prisma';
import { logger } from '../config/logger';

const STALE_LOCK_MINUTES = 10;

export type CronJobName = 'queue' | 'leads' | 'followups';

/**
 * Attempts to claim the named job's lock. Returns true if claimed (caller
 * should proceed and MUST call releaseCronLock when done, ideally in a
 * finally block), false if another instance already holds it.
 *
 * Why a DB row instead of Postgres advisory locks: advisory locks are
 * session-scoped, and Neon's pooled/serverless connections don't reliably
 * preserve a single session across statements, especially under
 * transaction-mode pooling — an advisory lock taken on one pooled
 * connection can be silently released or never actually held. A plain row
 * with an optimistic "claim if stale or free" UPDATE works correctly
 * regardless of pooling mode, and matches the stale-job-reset pattern
 * already used elsewhere in this codebase (see emailQueue/leadQueue
 * services' "reset PROCESSING rows stuck for N minutes" queries).
 *
 * A stale lock (held longer than STALE_LOCK_MINUTES, e.g. a crashed
 * invocation that never released it) is treated as free automatically —
 * there's no scenario where these jobs should legitimately run that long,
 * so this can't mask a real problem, only recover from one.
 */
export async function acquireCronLock(name: CronJobName): Promise<boolean> {
  try {
    // Ensure the row exists (safe to call even if the seed migration ran).
    await prisma.cronLock.upsert({ where: { name }, update: {}, create: { name } });

    const claimed = await prisma.$executeRaw`
      UPDATE "CronLock"
      SET "locked_at" = NOW()
      WHERE name = ${name}
      AND ("locked_at" IS NULL OR "locked_at" < NOW() - INTERVAL '1 minute' * ${STALE_LOCK_MINUTES})
    `;

    return claimed > 0;
  } catch (error) {
    // Fail open on lock-infrastructure errors — a missed lock means at worst
    // some duplicate work (already safe per-row via SKIP LOCKED / atomic
    // claims), whereas failing closed would mean NOTHING ever runs if this
    // table has a transient issue.
    logger.error({ error, name }, 'Failed to acquire cron lock — proceeding without it');
    return true;
  }
}

export async function releaseCronLock(name: CronJobName): Promise<void> {
  try {
    await prisma.cronLock.update({ where: { name }, data: { lockedAt: null } });
  } catch (error) {
    logger.error({ error, name }, 'Failed to release cron lock (will self-heal via staleness check)');
  }
}

/** Runs `fn` only if the named lock can be claimed; always releases it after. */
export async function withCronLock<T>(name: CronJobName, fn: () => Promise<T>): Promise<T | { skipped: true }> {
  const claimed = await acquireCronLock(name);
  if (!claimed) {
    logger.info({ name }, 'Cron job already running on another instance — skipping this invocation');
    return { skipped: true };
  }
  try {
    return await fn();
  } finally {
    await releaseCronLock(name);
  }
}
