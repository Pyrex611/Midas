import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export class SnapshotService {
  async captureDailySnapshots(): Promise<{ domainsProcessed: number; snapshotDate: string }> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const snapshotDate = todayStart.toISOString().split('T')[0];

    const domains = await prisma.domain.findMany({
      where: { status: { in: ['active', 'paused_health_risk'] } },
      select: { id: true },
    });

    let domainsProcessed = 0;

    for (const domain of domains) {
      try {
        const [
          sentCount,
          clickCount,
          bounceCount,
          complaintCount,
          replyCount,
          openEvents,
        ] = await Promise.all([
          prisma.outboundEmail.count({
            where: {
              domainId: domain.id,
              isIncoming: false,
              sentAt: { gte: todayStart },
              status: { in: ['SENT', 'BOUNCED'] },
            },
          }),
          prisma.outboundEmail.count({
            where: {
              domainId: domain.id,
              isIncoming: false,
              clickedAt: { gte: todayStart },
            },
          }),
          prisma.outboundEmail.count({
            where: {
              domainId: domain.id,
              isIncoming: false,
              bouncedAt: { gte: todayStart },
            },
          }),
          prisma.outboundEmail.count({
            where: {
              domainId: domain.id,
              isIncoming: false,
              spamComplaint: true,
              sentAt: { gte: todayStart },
            },
          }),
          prisma.outboundEmail.count({
            where: {
              domainId: domain.id,
              isIncoming: true,
              sentAt: { gte: todayStart },
            },
          }),
          prisma.outboundEmail.findMany({
            where: {
              domainId: domain.id,
              isIncoming: false,
              sentAt: { gte: todayStart },
            },
            select: { openedAt: true },
          }),
        ]);

        const humanOpenCount = openEvents.filter((e) => Boolean(e.openedAt)).length;
        const rawOpenCount = humanOpenCount;

        await prisma.domainHealthSnapshot.upsert({
          where: {
            domainId_snapshotDate: {
              domainId: domain.id,
              snapshotDate,
            },
          },
          update: {
            sentCount,
            rawOpenCount,
            humanOpenCount,
            clickCount,
            replyCount,
            bounceCount,
            complaintCount,
          },
          create: {
            domainId: domain.id,
            snapshotDate,
            sentCount,
            rawOpenCount,
            humanOpenCount,
            clickCount,
            replyCount,
            bounceCount,
            complaintCount,
          },
        });

        domainsProcessed++;
      } catch (err: any) {
        logger.warn({ err: err?.message, domainId: domain.id }, 'Failed to capture domain health snapshot');
      }
    }

    return { domainsProcessed, snapshotDate };
  }

  async getDomainSnapshots(userId: string, domainId: string, days: number = 30) {
    const domain = await prisma.domain.findFirst({
      where: { id: domainId, userId },
      select: { id: true },
    });
    if (!domain) throw new Error('Domain not found');

    return prisma.domainHealthSnapshot.findMany({
      where: { domainId },
      orderBy: { snapshotDate: 'desc' },
      take: Math.min(90, Math.max(1, days)),
    });
  }
}

export const snapshotService = new SnapshotService();