import { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { aiService } from '../../services/ai.service';
import { emailQueueService } from '../../services/emailQueue.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CampaignRequest } from '../../middleware/campaignAccess.middleware';
import { logger } from '../../config/logger';

const CAMPAIGN_UPDATABLE_FIELDS = ['name', 'description', 'context', 'reference', 'senderName'] as const;

export const createCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      name,
      description,
      context,
      reference,
      senderName,
      leadIds,
      autoReplyEnabled,
      sendHourUTC,
      objective,
      targetTool,
      extendedObjective,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Campaign name is required' });

    const campaign = await prisma.$transaction(async (tx) => {
      const camp = await tx.campaign.create({
        data: {
          userId,
          name,
          description,
          context,
          reference,
          senderName,
          status: leadIds?.length ? 'ACTIVE' : 'DRAFT',
          startedAt: leadIds?.length ? new Date() : null,
          autoReplyEnabled: autoReplyEnabled ?? false,
          sendHourUTC: sendHourUTC ?? 9,
          objective,
          targetTool,
          extendedObjective,
          ...(leadIds?.length && {
            leads: { connect: leadIds.map((lid: string) => ({ id: lid })) },
          }),
        },
      });

      await tx.campaignMember.create({
        data: {
          campaignId: camp.id,
          userId,
          role: 'OWNER',
        },
      });

      return camp;
    });

    let initialDraftData = {
      subject: `Quick question regarding {{company}}`,
      body: `Hi {{name}},\n\nI noticed your work at {{company}}. We help teams automate pipeline conversion without adding overhead.\n\nWorth exploring?\n\nBest,\n{{senderName}}`,
    };

    try {
      const generated = await Promise.race([
        aiService.generateDraft({
          tone: 'professional',
          useCase: 'initial',
          campaignContext: context,
          reference,
          userId,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI initial draft generation timed out')), 4000)
        ),
      ]);
      if (generated && generated.subject && generated.body) {
        initialDraftData = generated;
      }
    } catch (aiErr: any) {
      logger.warn({ err: aiErr?.message }, 'Primary draft AI synthesis timed out or failed — utilizing baseline');
    }

    const savedInitialDraft = await prisma.draft.create({
      data: {
        userId,
        campaignId: campaign.id,
        subject: initialDraftData.subject,
        body: initialDraftData.body,
        tone: 'professional',
        useCase: 'initial',
      },
    });

    await prisma.followUpStep.create({
      data: {
        campaignId: campaign.id,
        stepNumber: 1,
        delayDays: 3,
      },
    });

    if (leadIds?.length) {
      await prisma.lead.updateMany({
        where: { id: { in: leadIds }, userId },
        data: { outreachStatus: 'PENDING', campaignId: campaign.id },
      });

      const pendingRecords = leadIds.map((leadId: string) => ({
        userId,
        campaignId: campaign.id,
        leadId,
        draftId: savedInitialDraft.id,
        subject: savedInitialDraft.subject,
        body: savedInitialDraft.body,
        status: 'PENDING',
        priority: 1,
        scheduledAt: new Date(),
      }));

      await prisma.pendingEmail.createMany({
        data: pendingRecords,
      });

      emailQueueService.processQueue().catch(err => {
        logger.error({ err }, 'Background queue trigger failed');
      });
    }

    res.status(201).json({
      success: true,
      campaignId: campaign.id,
      message: leadIds?.length ? `Campaign started with ${leadIds.length} leads queued` : 'Campaign created',
    });
  } catch (error) {
    next(error);
  }
};

export const getCampaigns = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const campaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { leads: true, emails: true, drafts: true },
        },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    const withRole = campaigns.map(c => ({
      ...c,
      role: c.userId === userId ? 'OWNER' : (c.members[0]?.role ?? 'VIEWER'),
    }));

    res.json(withRole);
  } catch (error) {
    next(error);
  }
};

export const getCampaignDetails = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        leads: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            position: true,
            outreachStatus: true,
            status: true,
            createdAt: true,
          },
        },
        drafts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        emails: {
          orderBy: { sentAt: 'desc' },
          take: 200,
        },
        followUpSteps: {
          orderBy: { stepNumber: 'asc' },
        },
        senderLinks: {
          include: { sender: { include: { domain: true } } },
        },
      },
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const draftsWithStats = await Promise.all(
      campaign.drafts.map(async (d) => {
        const [opens, clicks] = await Promise.all([
          prisma.outboundEmail.count({ where: { draftId: d.id, openedAt: { not: null } } }),
          prisma.outboundEmail.count({ where: { draftId: d.id, clickedAt: { not: null } } }),
        ]);

        return {
          ...d,
          openCount: opens,
          clickCount: clicks,
          openRate: d.sentCount > 0 ? Math.round((opens / d.sentCount) * 100) : 0,
          clickRate: d.sentCount > 0 ? Math.round((clicks / d.sentCount) * 100) : 0,
          replyRate: d.sentCount > 0 ? Math.round((d.replyCount / d.sentCount) * 100) : 0,
        };
      })
    );

    const [queuedCount, sentCount, openedCount, clickedCount, replyCount, bounceCount, unsubscribedCount] = await Promise.all([
      prisma.pendingEmail.count({ where: { campaignId: id, status: 'PENDING' } }),
      prisma.outboundEmail.count({ where: { campaignId: id, isIncoming: false } }),
      prisma.outboundEmail.count({ where: { campaignId: id, isIncoming: false, openedAt: { not: null } } }),
      prisma.outboundEmail.count({ where: { campaignId: id, isIncoming: false, clickedAt: { not: null } } }),
      prisma.outboundEmail.count({ where: { campaignId: id, isIncoming: true } }),
      prisma.outboundEmail.count({ where: { campaignId: id, status: 'BOUNCED' } }),
      prisma.lead.count({ where: { campaignId: id, status: 'UNSUBSCRIBED' } }),
    ]);

    const totalLeads = campaign.leads.length;
    const contactedCount = campaign.leads.filter(l => l.outreachStatus === 'SENT' || l.status === 'CONTACTED' || l.status === 'REPLIED').length;

    const analytics = {
      totalLeads,
      contactedCount,
      queuedCount,
      sentCount,
      openedCount,
      clickedCount,
      replyCount,
      bounceCount,
      unsubscribedCount,
      openRate: sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0,
      clickRate: sentCount > 0 ? Math.round((clickedCount / sentCount) * 100) : 0,
      replyRate: sentCount > 0 ? Math.round((replyCount / sentCount) * 100) : 0,
      bounceRate: sentCount > 0 ? Number(((bounceCount / sentCount) * 100).toFixed(1)) : 0,
    };

    res.json({
      ...campaign,
      drafts: draftsWithStats,
      queuedCount,
      analytics,
      role: req.campaignRole,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCampaignStrategy = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.id;
    const { objective, targetTool, extendedObjective } = req.body;

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        objective,
        targetTool,
        extendedObjective,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const updateCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data: Record<string, any> = {};
    for (const field of CAMPAIGN_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    const updated = await prisma.campaign.update({ where: { id }, data });
    res.json(updated);
  } catch (error) { next(error); }
};

export const deleteCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.campaign.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
};