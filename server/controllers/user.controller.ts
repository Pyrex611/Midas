import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            leads: true,
            drafts: true,
            emails: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const campaignIds = campaigns.map((c) => c.id);
    const emailAggregates =
      campaignIds.length > 0
        ? await prisma.outboundEmail.groupBy({
            by: ['campaignId', 'isIncoming'],
            where: { campaignId: { in: campaignIds } },
            _count: { _all: true },
          })
        : [];

    const statsMap = new Map<string, { sent: number; replies: number }>();
    for (const row of emailAggregates) {
      if (!row.campaignId) continue;
      const entry = statsMap.get(row.campaignId) || { sent: 0, replies: 0 };
      if (row.isIncoming) entry.replies += row._count._all;
      else entry.sent += row._count._all;
      statsMap.set(row.campaignId, entry);
    }

    const campaignStats = campaigns.map((campaign) => {
      const counts = statsMap.get(campaign.id) || { sent: 0, replies: 0 };
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        leads: campaign._count.leads,
        drafts: campaign._count.drafts,
        sentEmails: counts.sent,
        replies: counts.replies,
        replyRate: counts.sent > 0 ? Math.round((counts.replies / counts.sent) * 100) : 0,
      };
    });

    res.json({
      user,
      campaigns: campaignStats,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get profile');
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'Name must be a string' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { id: true, email: true, name: true },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Failed to update profile');
    next(error);
  }
};