import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import crypto from 'crypto';
import { logger } from '../config/logger';

export const createInvite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: campaignId } = req.params;
    const { email, role } = req.body;
    const senderId = req.user!.id;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const invite = await prisma.campaignInvite.create({
      data: {
        campaignId,
        senderId,
        email: email.toLowerCase(),
        role: role || 'EDITOR',
        token,
        expiresAt
      }
    });

    // TODO: Send email to the invited user with the token link
    logger.info({ inviteId: invite.id, email }, 'Campaign invite created');

    res.status(201).json({ success: true, inviteId: invite.id });
  } catch (error) {
    next(error);
  }
};

export const acceptInvite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    const invite = await prisma.campaignInvite.findUnique({
      where: { token },
      include: { campaign: true }
    });

    if (!invite || invite.accepted || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invite' });
    }

    if (invite.email !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'This invite was intended for a different email address' });
    }

    // Use a transaction to join the campaign and close the invite
    await prisma.$transaction([
      prisma.campaignMember.create({
        data: {
          campaignId: invite.campaignId,
          userId,
          role: invite.role
        }
      }),
      prisma.campaignInvite.update({
        where: { id: invite.id },
        data: { accepted: true }
      })
    ]);

    res.json({ success: true, campaignId: invite.campaignId });
  } catch (error) {
    next(error);
  }
};

export const getMyInvites = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userEmail = req.user!.email;

    const invites = await prisma.campaignInvite.findMany({
      where: { 
        email: userEmail.toLowerCase(), 
        accepted: false,
        expiresAt: { gt: new Date() } 
      },
      include: { 
        campaign: { select: { name: true } },
        sender: { select: { name: true, email: true } } 
      }
    });

    res.json(invites);
  } catch (error) {
    next(error);
  }
};