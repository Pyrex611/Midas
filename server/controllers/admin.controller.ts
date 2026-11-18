import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, invalidateUserCache } from '../middleware/auth.middleware';
import { AdminAuthRequest } from '../middleware/requireAdmin.middleware';
import { verifyMasterPassphrase, generateOperatorToken } from '../lib/operatorAuth';
import { aiService } from '../services/ai.service';
import { logger } from '../config/logger';

/**
 * GET /api/admin/access-status
 * Lightweight probe behind requireAuth (never requireAdmin) allowing the UI to
 * determine whether /admin is open via DB isAdmin, Bootstrap Mode (0 admins),
 * or Operator Token—or strictly forbidden (redirect to dashboard).
 */
export const getAdminAccessStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [freshUser, adminCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, isAdmin: true },
      }),
      prisma.user.count({ where: { isAdmin: true } }),
    ]);

    const isAdmin = Boolean(freshUser?.isAdmin);
    const isBootstrapMode = adminCount === 0;
    const passphraseConfigured = Boolean(
      (process.env.OPERATOR_PASSPHRASE || process.env.ADMIN_PASSPHRASE || '').trim().length >= 12
    );

    res.json({
      hasAccess: isAdmin || isBootstrapMode,
      isAdmin,
      isBootstrapMode,
      adminCount,
      passphraseConfigured,
      currentUserId: req.user!.id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/unlock
 */
export const unlockAdminAccess = async (req: Request, res: Response) => {
  const { passphrase } = req.body;

  if (!passphrase || typeof passphrase !== 'string') {
    return res.status(400).json({ error: 'Passphrase is required' });
  }

  const isValid = verifyMasterPassphrase(passphrase);
  if (!isValid) {
    logger.warn({ ip: req.ip }, 'Failed operator admin unlock attempt');
    return res.status(401).json({ error: 'Invalid operator passphrase or passphrase unlock is disabled.' });
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
 * POST /api/admin/users/:id/admin
 * Grants or revokes platform Superadmin status with Zero-Lockout Last-Admin protection.
 */
export const toggleUserAdmin = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.id;
    const { isAdmin } = req.body;

    if (typeof isAdmin !== 'boolean') {
      return res.status(400).json({ error: 'isAdmin boolean is required' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, isAdmin: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (!isAdmin && target.isAdmin) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Zero-Lockout Guard: Cannot revoke the last remaining platform administrator. Promote another user first.',
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { isAdmin },
      select: { id: true, email: true, name: true, isAdmin: true },
    });

    invalidateUserCache(updated.id);
    invalidateUserCache(updated.email);

    logger.info(
      { actorId: req.user!.id, targetId: updated.id, targetEmail: updated.email, isAdmin },
      '[ADMIN] Platform admin privileges updated'
    );

    res.json({ success: true, user: updated });
  } catch (error) {
    next(error);
  }
};

export const getSystemServicesHealth = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [dbResult, aiResult, cronLocks, domainsSummary] = await Promise.all([
      (async () => {
        const start = Date.now();
        try {
          await prisma.$queryRaw`SELECT 1`;
          return { status: 'HEALTHY', latencyMs: Date.now() - start };
        } catch (err: any) {
          return { status: 'ERROR', error: err?.message || String(err) };
        }
      })(),
      aiService.testActiveProvider(),
      prisma.cronLock.findMany(),
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
        subscription: { select: { plan: true, status: true, emailsSentThisMonth: true } },
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

export const pauseDomain = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.user?.isAdmin && !req.isBootstrapAdminAccess) {
      const actionPassphrase = (req.headers['x-action-passphrase'] as string) || req.body?.actionPassphrase;
      if (!actionPassphrase || !verifyMasterPassphrase(actionPassphrase)) {
        return res.status(403).json({
          error: 'Action Protected: Re-enter operator passphrase to confirm domain pause.',
          requiresActionConfirmation: true,
        });
      }
    }

    const domain = await prisma.domain.update({
      where: { id },
      data: { status: 'paused_health_risk' },
    });

    logger.warn({ domainId: domain.id, domainName: domain.domainName }, 'Operator tripped circuit breaker: domain paused');
    res.json({ id: domain.id, status: domain.status });
  } catch (error) { next(error); }
};

export const unpauseDomain = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.user?.isAdmin && !req.isBootstrapAdminAccess) {
      const actionPassphrase = (req.headers['x-action-passphrase'] as string) || req.body?.actionPassphrase;
      if (!actionPassphrase || !verifyMasterPassphrase(actionPassphrase)) {
        return res.status(403).json({
          error: 'Action Protected: Re-enter operator passphrase to reactivate domain.',
          requiresActionConfirmation: true,
        });
      }
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