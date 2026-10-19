import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

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

/** Every domain across every tenant, with its health, so one bad account can be spotted before it burns shared platform reputation. */
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

    // Never return the encrypted key itself — only whether one is set.
    res.json(domains.map(({ mailgunApiKeyEncrypted, ...d }) => ({ ...d, hasMailgunKey: !!mailgunApiKeyEncrypted })));
  } catch (error) { next(error); }
};

export const pauseDomain = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const domain = await prisma.domain.update({
      where: { id },
      data: { status: 'paused_health_risk' },
    });
    res.json({ id: domain.id, status: domain.status });
  } catch (error) { next(error); }
};

export const unpauseDomain = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const domain = await prisma.domain.update({
      where: { id },
      data: { status: 'active', bounceRate: 0, complaintRate: 0 },
    });
    res.json({ id: domain.id, status: domain.status });
  } catch (error) { next(error); }
};

/** Coarse platform-wide numbers for a single at-a-glance operator view. */
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
