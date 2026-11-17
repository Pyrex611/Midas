import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CampaignRequest } from '../../middleware/campaignAccess.middleware';
import { reconcileCampaignQueue } from './campaign.queue.controller';
import { planGuardService } from '../../services/billing/planGuard.service';

export const addLeadsToCampaign = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non-empty array' });
    }

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // SECURITY: Leads a user adds must belong to that user (prevents cross-tenant IDOR).
    const claimResult = await prisma.lead.updateMany({
      where: { id: { in: leadIds }, userId },
      data: { campaignId: id, outreachStatus: 'PENDING' },
    });

    if (campaign.status === 'DRAFT') {
      await prisma.campaign.update({
        where: { id },
        data: { status: 'ACTIVE', startedAt: new Date() },
      });
    }

    const reconciliation = await reconcileCampaignQueue(id, userId);

    res.json({
      added: claimResult.count,
      skipped: leadIds.length - claimResult.count,
      queued: reconciliation.queuedCount,
      message: reconciliation.message,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyInvites = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.user!.email;
    if (!email) return res.json([]);

    const invites = await prisma.campaignInvite.findMany({
      where: {
        email: email.toLowerCase().trim(),
        accepted: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        campaign: { select: { name: true } },
        sender: { select: { name: true, email: true } },
      },
    });
    res.json(invites);
  } catch (error) {
    next(error);
  }
};

export const acceptInvite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const userEmail = (req.user!.email || '').toLowerCase().trim();
    const { token } = req.params;

    const invite = await prisma.campaignInvite.findUnique({ where: { token } });

    if (!invite || invite.accepted || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation token.' });
    }

    if (invite.email.toLowerCase().trim() !== userEmail) {
      return res.status(403).json({
        error: 'This invitation was issued to a different email address.',
      });
    }

    await prisma.$transaction([
      prisma.campaignInvite.update({
        where: { id: invite.id },
        data: { accepted: true },
      }),
      prisma.campaignMember.upsert({
        where: {
          campaignId_userId: {
            campaignId: invite.campaignId,
            userId,
          },
        },
        update: { role: invite.role },
        create: {
          campaignId: invite.campaignId,
          userId,
          role: invite.role,
        },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const createInvite = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const senderId = req.user!.id;
    const ownerId = req.campaign?.userId || senderId;
    const campaignId = req.params.id;
    const { email, role } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
      await planGuardService.assertFeatureAccess(ownerId, 'allowTeamInvites');
    } catch (guardErr: any) {
      return res.status(403).json({ error: guardErr.message });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.campaignInvite.create({
      data: {
        campaignId,
        senderId,
        email: email.toLowerCase().trim(),
        role: role === 'VIEWER' ? 'VIEWER' : 'EDITOR',
        token,
        expiresAt,
      },
    });

    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
};

export const getCampaignSenders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const links = await prisma.campaignSender.findMany({
      where: { campaignId: id },
      include: { sender: { include: { domain: true } } },
    });
    res.json(links.map(l => l.sender));
  } catch (error) { next(error); }
};

export const addSenderToCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { senderId } = req.body;

    const sender = await prisma.sender.findFirst({ where: { id: senderId, userId } });
    if (!sender) return res.status(404).json({ error: 'Sender not found on your account' });

    const link = await prisma.campaignSender.upsert({
      where: {
        campaignId_senderId: {
          campaignId: id,
          senderId,
        },
      },
      update: {},
      create: { campaignId: id, senderId },
    });

    res.status(201).json(link);
  } catch (error) { next(error); }
};

export const removeSenderFromCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const senderId = req.params.senderId as string;
    await prisma.campaignSender.deleteMany({
      where: { campaignId: id, senderId },
    });
    res.status(204).send();
  } catch (error) { next(error); }
};