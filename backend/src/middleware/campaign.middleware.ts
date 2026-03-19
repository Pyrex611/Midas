import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth.middleware';

export const requireCampaignAccess = (minRole: 'OWNER' | 'EDITOR' | 'VIEWER') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!.id;
    const campaignId = req.params.id || req.params.campaignId;

    if (!campaignId) return res.status(400).json({ error: 'Campaign ID required' });

    // Check if user is the absolute owner OR a member with high enough role
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        members: { where: { userId } }
      }
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const isCreator = campaign.userId === userId;
    const membership = campaign.members[0];

    // Ownership logic
    if (isCreator) return next();

    // Membership logic
    if (!membership) return res.status(403).json({ error: 'No access to this campaign' });

    const roles = ['VIEWER', 'EDITOR', 'OWNER'];
    if (roles.indexOf(membership.role) < roles.indexOf(minRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};