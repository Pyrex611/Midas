import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CampaignRequest } from '../../middleware/campaignAccess.middleware';
import { reconcileCampaignQueue } from './campaign.queue.controller';

export const addLeadsToCampaign = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non-empty array' });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { leads: { select: { id: true } } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
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
      added: leadIds.length,
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
    const { token } = req.params;

    const invite = await prisma.campaignInvite.findUnique({ where: { token } });

    if (!invite || invite.accepted || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation token.' });
    }

    await prisma.$transaction([
      prisma.campaignInvite.update({
        where: { id: invite.id },
        data: { accepted: true },
      }),
      prisma.campaignMember.create({
        data: {
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
    const campaignId = req.params.id;
    const { email, role } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

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