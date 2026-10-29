import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  verifyMasterPassphrase,
  generateOperatorToken,
} from '../lib/operatorAuth';
import { aiService } from '../services/ai.service';
import { logger } from '../config/logger';

/**
 * POST /api/admin/unlock
 * Verifies master passphrase and issues a 60-minute sliding operator session.
 */
export const unlockAdminAccess = async (req: Request, res: Response) => {
  const { passphrase } = req.body;

  if (!passphrase || typeof passphrase !== 'string') {
    return res.status(400).json({ error: 'Passphrase is required' });
  }

  const isValid = verifyMasterPassphrase(passphrase);
  if (!isValid) {
    logger.warn({ ip: req.ip }, 'Failed operator admin unlock attempt');
    return res.status(401).json({ error: 'Invalid operator passphrase' });
  }

  const { token, expiresAt } = generateOperatorToken();
  logger.info({ ip: req.ip }, 'Operator admin clearance granted (60-minute window)');

  res.json({
    success: true,
    token,
    expiresAt,
    message: 'Operator clearance granted for 60 minutes of active use.',
  });
};

/**
 * GET /api/admin/services-health
 * Real-time diagnostic inspection across Database, AI Engine, Mailgun, and CronLocks.
 */
export const getSystemServicesHealth = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [dbResult, aiResult, cronLocks, domainsSummary] = await Promise.all([
      // 1. Neon Database Health & Latency Probe
      (async () => {
        const start = Date.now();
        try {
          await prisma.$queryRaw`SELECT 1`;
          return { status: 'HEALTHY', latencyMs: Date.now() - start };
        } catch (err: any) {
          return { status: 'ERROR', error: err?.message || String(err) };
        }
      })(),

      // 2. AI Engine Probe
      aiService.testActiveProvider(),

      // 3. CronLock Inspection
      prisma.cronLock.findMany(),

      // 4. Domains Overview
      prisma.domain.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    res.json({
      database: dbResult,
      aiEngine: aiResult,
      cronLocks,
      domainsSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/admin/locks/:name/clear
 * Clears a stuck cron lock manually.
 */
export const clearCronLock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    await prisma.cronLock.update({
      where: { name },
      data: { lockedAt: null },
    });
    logger.info({ lockName: name }, 'Operator cleared stuck CronLock');
    res.json({ success: true, message: `CronLock "${name}" reset to available.` });
  } catch (error) { next(error); }
};

export const listUsers = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { campaigns: true, leads: true, domains: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) { next(error); }
};

export const listAllDomains = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const domains = await prisma.domain.findMany({
      select: {
        id: true,
        domainName: true,
        status: true,
        bounceRate: true,
        complaintRate: true,
        sendTestPassedAt: true,
        receivingConfirmedAt: true,
        mailgunApiKeyEncrypted: true,
        createdAt: true,
        user: { select: { email: true } },
        senders: { select: { id: true, localPart: true, dailyLimit: true, sentCountToday: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(domains.map(({ mailgunApiKeyEncrypted, ...d }) => ({ ...d, hasMailgunKey: !!mailgunApiKeyEncrypted })));
  } catch (error) { next(error); }
};

export const pauseDomain = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actionPassphrase = (req.headers['x-action-passphrase'] as string) || req.body?.actionPassphrase;

    if (!actionPassphrase || !verifyMasterPassphrase(actionPassphrase)) {
      return res.status(403).json({
        error: 'Action Protected: Re-enter operator passphrase to confirm domain pause.',
        requiresActionConfirmation: true,
      });
    }

    const domain = await prisma.domain.update({
      where: { id },
      data: { status: 'paused_health_risk' },
    });

    logger.warn({ domainId: domain.id, domainName: domain.domainName }, 'Operator tripped circuit breaker: domain paused');
    res.json({ id: domain.id, status: domain.status });
  } catch (error) { next(error); }
};

export const unpauseDomain = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actionPassphrase = (req.headers['x-action-passphrase'] as string) || req.body?.actionPassphrase;

    if (!actionPassphrase || !verifyMasterPassphrase(actionPassphrase)) {
      return res.status(403).json({
        error: 'Action Protected: Re-enter operator passphrase to reactivate domain.',
        requiresActionConfirmation: true,
      });
    }

    const domain = await prisma.domain.update({
      where: { id },
      data: { status: 'active', bounceRate: 0, complaintRate: 0 },
    });

    logger.info({ domainId: domain.id, domainName: domain.domainName }, 'Operator reset circuit breaker: domain unpaused');
    res.json({ id: domain.id, status: domain.status });
  } catch (error) { next(error); }
};

export const getPlatformStats = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [userCount, campaignCount, leadCount, domainCount, sentToday, pendingCount] = await Promise.all([
      prisma.user.count(),
      prisma.campaign.count(),
      prisma.lead.count(),
      prisma.domain.count(),
      prisma.outboundEmail.count({
        where: { isIncoming: false, sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.pendingEmail.count(),
    ]);
    res.json({ userCount, campaignCount, leadCount, domainCount, sentToday, pendingCount });
  } catch (error) { next(error); }
};