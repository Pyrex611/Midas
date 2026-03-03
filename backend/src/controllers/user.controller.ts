import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

/**
 * GET /api/user/profile
 * Return the authenticated user's profile and aggregated campaign stats.
 */
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch all campaigns for this user with counts
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
        // We also need reply count per campaign: count of incoming emails where repliedAt is not null
      },
    });

    // For reply rate, we need to count sent emails and replies
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
 * Update user's name.
 */
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'Name must be a string' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Failed to update profile');
    next(error);
  }
};