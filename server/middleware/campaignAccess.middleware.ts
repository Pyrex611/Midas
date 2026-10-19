import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth.middleware';

export type CampaignRole = 'OWNER' | 'EDITOR' | 'VIEWER';
const ROLE_RANK: Record<CampaignRole, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

export interface CampaignRequest extends AuthRequest {
  /** The campaign row this request targets, resolved once here and reused by the controller. */
  campaign?: { id: string; userId: string; [key: string]: any };
  /** The caller's effective role on this campaign. */
  campaignRole?: CampaignRole;
}

/**
 * Resolves the campaign referenced by `:id` or `:campaignId`, determines the
 * caller's role (OWNER if they created it, otherwise their CampaignMember
 * row, otherwise none), and rejects the request if that role doesn't meet
 * `minRole`.
 *
 * This closes the IDOR gap where most campaign/draft/domain/follow-up
 * endpoints previously trusted `req.params.id` with no ownership or
 * membership check at all, and makes the "Viewer (Read-only)" label in the
 * invite UI actually true.
 *
 * Apply this to every route under /campaigns/:id* and /campaigns/:campaignId*
 * — see server/routes/campaign.routes.ts for the per-endpoint role map.
 */
export function requireCampaignRole(minRole: CampaignRole) {
  return async (req: CampaignRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const campaignId = (req.params.id || req.params.campaignId) as string | undefined;

      if (!campaignId) {
        return res.status(400).json({ error: 'Campaign id is required' });
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { members: { where: { userId }, select: { role: true } } },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      let role: CampaignRole | null = null;
      if (campaign.userId === userId) {
        role = 'OWNER';
      } else if (campaign.members[0]) {
        role = campaign.members[0].role as CampaignRole;
      }

      if (!role) {
        // Don't leak whether the campaign exists to non-members.
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
        return res.status(403).json({
          error: `Forbidden: this action requires ${minRole} access, you have ${role} access`,
        });
      }

      req.campaign = campaign;
      req.campaignRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}
