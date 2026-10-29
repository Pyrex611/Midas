import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

/**
 * GET /api/user/profile
 * Returns authenticated user's profile and aggregated campaign performance metrics.
 */
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Fetch user profile
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

    // Fetch all campaigns owned by this user with count aggregates
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

    // Compute sent counts, reply counts, and reply rate per campaign
    const campaignStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const sentCount = await prisma.outboundEmail.count({
          where: {
            campaignId: campaign.id,
            isIncoming: false,
          },
        });
        const replyCount = await prisma.outboundEmail.count({
          where: {
            campaignId: campaign.id,
            isIncoming: true,
          },
        });
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          leads: campaign._count.leads,
          drafts: campaign._count.drafts,
          sentEmails: sentCount,
          replies: replyCount,
          replyRate: sentCount > 0 ? Math.round((replyCount / sentCount) * 100) : 0,
        };
      })
    );

    res.json({
      user,
      campaigns: campaignStats,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get profile');
    next(error);
  }
};

/**
 * PUT /api/user/profile
 * Updates the user's display name in PostgreSQL.
 */
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'A valid name string is required' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { id: true, email: true, name: true, isAdmin: true },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Failed to update profile');
    next(error);
  }
};