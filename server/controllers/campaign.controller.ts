import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import { aiService } from '../services/ai.service';
import { emailQueueService } from '../services/emailQueue.service';
import { complianceService } from '../services/compliance.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';
import { CampaignRequest } from '../middleware/campaignAccess.middleware';
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from '../lib/unsubscribe';

/**
 * Self-Healing Queue Reconciler:
 * Checks every lead in the campaign. Queues uncontacted leads for initial outreach
 * and checks if any scheduled follow-up steps are due for contacted leads.
 */
export async function reconcileCampaignQueue(campaignId: string, userId: string): Promise<{ queuedCount: number; message: string }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      drafts: { where: { isActive: true } },
      followUpSteps: { where: { enabled: true }, orderBy: { stepNumber: 'asc' } },
      leads: {
        include: {
          sentEmails: { orderBy: { sentAt: 'asc' } },
          pendingEmails: { where: { campaignId, status: { in: ['PENDING', 'PROCESSING'] } } },
        },
      },
    },
  });

  if (!campaign) throw new Error('Campaign not found');

  // 1. Ensure a usable initial draft exists (create baseline fallback if none exists)
  let initialDraft = campaign.drafts.find(d => d.useCase === 'initial') || campaign.drafts[0];
  if (!initialDraft) {
    initialDraft = await prisma.draft.create({
      data: {
        userId,
        campaignId,
        subject: `Quick question regarding {{company}}`,
        body: `Hi {{name}},\n\nI noticed your work at {{company}}. We help teams automate pipeline conversion without adding overhead.\n\nWorth exploring?\n\nBest,\n{{senderName}}`,
        tone: 'professional',
        useCase: 'initial',
      },
    });
  }

  let newlyQueued = 0;

  for (const lead of campaign.leads) {
    // Never queue unsubscribed or bounced leads
    if (lead.status === 'UNSUBSCRIBED' || lead.status === 'BOUNCED') {
      await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId } });
      continue;
    }

    // Has lead replied? If so, stop all campaign outreach
    const hasReplied = lead.sentEmails.some(e => e.isIncoming);
    if (hasReplied) {
      await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId } });
      continue;
    }

    const hasSentInitial = lead.sentEmails.some(e => !e.isIncoming);
    const hasActiveQueueItem = lead.pendingEmails.length > 0;

    // CASE A: Lead has never received an email and has no queue item -> Queue initial outreach
    if (!hasSentInitial && !hasActiveQueueItem) {
      await prisma.pendingEmail.create({
        data: {
          userId,
          campaignId,
          leadId: lead.id,
          draftId: initialDraft.id,
          subject: initialDraft.subject,
          body: initialDraft.body,
          status: 'PENDING',
          priority: 1,
          scheduledAt: new Date(),
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { outreachStatus: 'PENDING', campaignId },
      });

      newlyQueued++;
    }

    // CASE B: Lead received initial email, has no active queue item, and has not replied -> Check follow-up steps
    if (hasSentInitial && !hasActiveQueueItem && campaign.followUpSteps.length > 0) {
      const initialOutbound = lead.sentEmails.find(e => !e.isIncoming);
      if (initialOutbound) {
        const completedSteps = new Set<number>();
        lead.sentEmails.forEach(e => {
          if (e.draftId) {
            const d = campaign.drafts.find(draft => draft.id === e.draftId);
            if (d?.stepNumber) completedSteps.add(d.stepNumber);
          }
        });

        for (const step of campaign.followUpSteps) {
          if (completedSteps.has(step.stepNumber)) continue;

          const targetDate = new Date(initialOutbound.sentAt);
          targetDate.setDate(targetDate.getDate() + step.delayDays);

          if (new Date() >= targetDate) {
            const followUpDraft = campaign.drafts.find(d => d.useCase === 'followup' && d.stepNumber === step.stepNumber) || initialDraft;

            await prisma.pendingEmail.create({
              data: {
                userId,
                campaignId,
                leadId: lead.id,
                draftId: followUpDraft.id,
                subject: followUpDraft.subject,
                body: followUpDraft.body,
                inReplyTo: initialOutbound.messageId,
                domainId: initialOutbound.domainId,
                status: 'PENDING',
                priority: 2,
                scheduledAt: new Date(),
              },
            });

            newlyQueued++;
            break; // Queue one step at a time
          }
        }
      }
    }
  }

  if (newlyQueued > 0) {
    emailQueueService.processQueue().catch(err => {
      logger.error({ err }, 'Background queue sweep trigger failed on reconcile');
    });
  }

  return {
    queuedCount: newlyQueued,
    message: `Reconciliation complete: ${newlyQueued} lead(s) staged into active dispatch queue.`,
  };
}

async function generateBackgroundTonalDrafts(
  userId: string,
  campaignId: string,
  context?: string,
  reference?: string
) {
  const secondaryTones = ['friendly', 'urgent', 'data-driven', 'storytelling'];
  const requestDelayMs = Number(process.env.AI_REQUEST_DELAY_MS) || 500;

  for (const tone of secondaryTones) {
    try {
      await new Promise(resolve => setTimeout(resolve, requestDelayMs));
      const draft = await aiService.generateDraft(
        tone,
        'initial',
        context,
        reference,
        undefined,
        undefined,
        undefined
      );

      await prisma.draft.create({
        data: {
          userId,
          campaignId,
          subject: draft.subject,
          body: draft.body,
          tone,
          useCase: 'initial',
        },
      });
      logger.info({ campaignId, tone }, 'Background tonal draft generated successfully');
    } catch (err: any) {
      logger.warn({ err: err?.message, campaignId, tone }, 'Failed to generate background tonal draft');
    }
  }
}

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
        aiService.generateDraft('professional', 'initial', context, reference),
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

    generateBackgroundTonalDrafts(userId, campaign.id, context, reference).catch(err => {
      logger.error({ err }, 'Unhandled error in background tonal draft worker');
    });

    res.status(201).json({
      success: true,
      campaignId: campaign.id,
      message: leadIds?.length ? `Campaign started with ${leadIds.length} leads queued` : 'Campaign created',
    });
  } catch (error) {
    next(error);
  }
};

export const pauseCampaign = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
    logger.info({ campaignId: id }, 'Campaign paused by operator');
    res.json(updated);
  } catch (error) { next(error); }
};

export const resumeCampaign = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    // Automatically reconcile unqueued and follow-up leads on resume
    const reconciliation = await reconcileCampaignQueue(id, userId);
    logger.info({ campaignId: id, reconciliation }, 'Campaign resumed and reconciled');

    res.json({ ...updated, reconciliation });
  } catch (error) { next(error); }
};

export const reconcileQueueEndpoint = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const result = await reconcileCampaignQueue(id, userId);
    res.json(result);
  } catch (error) { next(error); }
};

export const getCampaignHealth = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        senderLinks: { include: { sender: { include: { domain: true } } } },
        _count: { select: { leads: true, pendingEmails: true } },
      },
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const alerts: Array<{
      severity: 'error' | 'warning' | 'info';
      title: string;
      message: string;
      actionLabel?: string;
      actionType?: 'RESUME' | 'ACTIVATE' | 'ASSIGN_SENDERS' | 'NAVIGATE_DOMAINS' | 'DISPATCH_NOW' | 'ADJUST_HOURS' | 'RECONCILE_QUEUE';
    }> = [];

    if (campaign.status === 'PAUSED') {
      alerts.push({
        severity: 'warning',
        title: 'Campaign Outreach is Paused',
        message: 'All automated sends and follow-up loops are currently halted.',
        actionLabel: 'Resume Outreach',
        actionType: 'RESUME',
      });
    }

    if (campaign.status === 'DRAFT') {
      alerts.push({
        severity: 'warning',
        title: 'Campaign in Draft Status',
        message: 'This campaign has not been launched yet.',
        actionLabel: 'Activate Campaign',
        actionType: 'ACTIVATE',
      });
    }

    const activeSenders = campaign.senderLinks
      .map(l => l.sender)
      .filter(s => s.status === 'active' && s.domain?.status === 'active');

    if (campaign.senderLinks.length === 0) {
      alerts.push({
        severity: 'error',
        title: 'No Sending Mailboxes Assigned',
        message: 'No mailboxes are attached to this campaign. The queue cannot dispatch emails without an assigned sender.',
        actionLabel: 'Assign Senders',
        actionType: 'ASSIGN_SENDERS',
      });
    } else if (activeSenders.length === 0) {
      alerts.push({
        severity: 'error',
        title: 'Attached Senders or Domains Are Inactive',
        message: 'The mailboxes attached to this campaign belong to domains that have failed connectivity tests or are paused.',
        actionLabel: 'Check Domains',
        actionType: 'NAVIGATE_DOMAINS',
      });
    }

    const allSendersMaxed = activeSenders.length > 0 && activeSenders.every(s => s.sentCountToday >= s.dailyLimit);
    if (allSendersMaxed) {
      alerts.push({
        severity: 'info',
        title: 'Daily Mailbox Capacity Reached',
        message: 'All assigned senders have reached their daily warmup quotas for today. Sends will resume at the next scheduled window.',
      });
    }

    const queuedCount = await prisma.pendingEmail.count({
      where: { campaignId: id, status: 'PENDING' },
    });

    // Unreconciled Leads Alert: Leads exist with outreachStatus PENDING but 0 in queue
    const unqueuedLeadsCount = await prisma.lead.count({
      where: {
        campaignId: id,
        outreachStatus: 'PENDING',
        pendingEmails: { none: { campaignId: id } },
      },
    });

    if (unqueuedLeadsCount > 0 && campaign.status === 'ACTIVE') {
      alerts.push({
        severity: 'warning',
        title: `${unqueuedLeadsCount} Lead(s) Not Yet Staged in Queue`,
        message: 'Leads are attached to this campaign but are missing active queue records.',
        actionLabel: 'Reconcile & Queue Leads Now',
        actionType: 'RECONCILE_QUEUE',
      });
    }

    const hasUnsentQueued = queuedCount > 0 && campaign.status === 'ACTIVE' && activeSenders.length > 0 && !allSendersMaxed;
    if (hasUnsentQueued) {
      alerts.push({
        severity: 'info',
        title: `${queuedCount} Email(s) Queued for Dispatch`,
        message: 'Emails are waiting in queue for the next scheduled cron tick.',
        actionLabel: 'Trigger Send Sweep Now',
        actionType: 'DISPATCH_NOW',
      });
    }

    res.json({
      status: campaign.status,
      queuedCount,
      leadsCount: campaign._count.leads,
      activeSendersCount: activeSenders.length,
      alerts,
    });
  } catch (error) { next(error); }
};

export const dispatchCampaignNow = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    // Auto-reconcile before sweeping
    await reconcileCampaignQueue(id, userId);
    const summary = await emailQueueService.processQueue();
    res.json({ success: true, summary });
  } catch (error) { next(error); }
};

export const gradeCampaignDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { subject, body } = req.body;

    if (!subject || !body || typeof subject !== 'string' || typeof body !== 'string') {
      return res.status(400).json({ error: 'Valid subject and body strings are required for deliverability grading' });
    }

    const grade = await complianceService.gradeEmail(userId, subject, body);
    res.json(grade);
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
      queuedCount,
      analytics,
      role: req.campaignRole,
    });
  } catch (error) {
    next(error);
  }
};

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

    // Link leads
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

    // Immediately reconcile queue so leads are guaranteed to be in PendingEmail
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

export const getLeadEmailThread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;

    const emails = await prisma.outboundEmail.findMany({
      where: { campaignId, leadId },
      orderBy: { sentAt: 'asc' },
    });

    const parsedEmails = emails.map(email => ({
      ...email,
      analysis: email.analysis ? (typeof email.analysis === 'string' ? JSON.parse(email.analysis) : email.analysis) : null,
    }));

    res.json(parsedEmails);
  } catch (error) {
    next(error);
  }
};

export const previewLeadWithDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const draftId = req.params.draftId as string;

    const [lead, campaign, draft] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.draft.findUnique({ where: { id: draftId } }),
    ]);

    if (!lead || !campaign || !draft) {
      return res.status(404).json({ error: 'Lead, Campaign, or Draft not found' });
    }

    const { subject, body } = personalisationService.personalise(
      lead,
      draft.subject,
      draft.body,
      campaign.reference,
      campaign.senderName
    );

    res.json({ leadId, campaignId, draftId, subject, body });
  } catch (error) {
    next(error);
  }
};

export const sendLeadEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const userId = req.user!.id;

    const [lead, campaign] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          senderLinks: { include: { sender: { include: { domain: true } } } },
        },
      }),
    ]);

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found' });
    if (lead.status === 'UNSUBSCRIBED') return res.status(400).json({ error: 'This lead has unsubscribed' });
    const draft = campaign.drafts[0];
    if (!draft) return res.status(400).json({ error: 'No active draft found' });

    const activeSender = campaign.senderLinks.map(l => l.sender).find(s => s.status === 'active' && s.domain.status === 'active');
    if (!activeSender) return res.status(400).json({ error: 'No active sender attached to this campaign' });

    const unsubscribeToken = await ensureUnsubscribeToken(lead.id, lead.unsubscribeToken);
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

    const { subject, body } = personalisationService.personalise(
      lead,
      draft.subject,
      draft.body,
      campaign.reference,
      activeSender.displayName || campaign.senderName,
      unsubscribeUrl
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeSender.domainId,
        leadId,
        campaignId,
        draftId: draft.id,
        subject,
        body,
        status: 'PROCESSING',
      },
    });

    const result = await emailService.sendEmailNow(
      { ...activeSender.domain, senderLocalPart: activeSender.localPart },
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      activeSender.displayName || campaign.senderName,
      undefined,
      unsubscribeUrl,
      { leadId: lead.id, campaignId: campaign.id }
    );

    if (!result.success) throw new Error(result.error);

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { outreachStatus: 'SENT', status: 'CONTACTED' },
    });

    res.json({ success: true, message: 'Email sent directly' });
  } catch (error) {
    next(error);
  }
};

export const getReplyDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const draft = await prisma.draft.findFirst({
      where: { leadId, campaignId, isReplyDraft: true, isActive: true },
    });
    if (!draft) return res.status(404).json({ error: 'No reply draft found' });
    res.json(draft);
  } catch (error) {
    next(error);
  }
};

export const generateReplyDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const userId = req.user!.id;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const latestReply = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });
    if (!latestReply) return res.status(400).json({ error: 'No incoming reply found' });

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    let analysis = { sentiment: 'neutral' };
    if (latestReply.analysis) {
      try {
        analysis = typeof latestReply.analysis === 'string' ? JSON.parse(latestReply.analysis) : latestReply.analysis;
      } catch (e) {}
    }

    const draftData = await aiService.generateDraft(
      'professional',
      'reply',
      campaign?.context,
      campaign?.reference,
      undefined,
      latestReply.body,
      analysis.sentiment
    );

    await prisma.draft.deleteMany({
      where: { leadId, campaignId, isReplyDraft: true },
    });

    const savedDraft = await prisma.draft.create({
      data: {
        userId,
        leadId,
        campaignId,
        subject: draftData.subject,
        body: draftData.body,
        tone: 'professional',
        useCase: 'reply',
        isReplyDraft: true,
      },
    });

    res.json(savedDraft);
  } catch (error) {
    next(error);
  }
};

export const sendReplyDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const { subject, body } = req.body;
    const userId = req.user!.id;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { senderLinks: { include: { sender: { include: { domain: true } } } } },
    });

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found' });

    const latestIncoming = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });

    const activeSenders = campaign.senderLinks.map(l => l.sender).filter(s => s.status === 'active' && s.domain.status === 'active');
    if (activeSenders.length === 0) return res.status(400).json({ error: 'No active sender found' });
    const activeSender = activeSenders.find(s => s.domainId === latestIncoming?.domainId) || activeSenders[0];

    const { subject: pSubject, body: pBody } = personalisationService.personalise(
      lead,
      subject,
      body,
      campaign.reference,
      activeSender.displayName || campaign.senderName
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeSender.domainId,
        leadId,
        campaignId,
        subject: pSubject,
        body: pBody,
        isIncoming: false,
        status: 'PROCESSING',
        replyToId: latestIncoming?.id,
      },
    });

    const result = await emailService.sendEmailNow(
      { ...activeSender.domain, senderLocalPart: activeSender.localPart },
      lead.email,
      pSubject,
      pBody.replace(/\n/g, '<br>'),
      pBody,
      outboundRecord.id,
      activeSender.displayName || campaign.senderName,
      latestIncoming?.messageId,
      undefined,
      { leadId: lead.id, campaignId: campaign.id }
    );

    if (!result.success) throw new Error(result.error);

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId },
    });

    await prisma.draft.deleteMany({ where: { leadId, campaignId, isReplyDraft: true } });

    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    next(error);
  }
};

export const updateAutoReply = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { autoReplyEnabled } = req.body;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { autoReplyEnabled: !!autoReplyEnabled },
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const updateSendHour = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { sendHourUTC } = req.body;
    const hour = Number(sendHourUTC);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'sendHourUTC must be an integer between 0 and 23' });
    }
    const updated = await prisma.campaign.update({
      where: { id },
      data: { sendHourUTC: hour },
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const updateActiveHours = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { activeStartHour, activeEndHour, timezone } = req.body;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { activeStartHour, activeEndHour, timezone },
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const getFollowUpSteps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const steps = await prisma.followUpStep.findMany({
      where: { campaignId: id },
      orderBy: { stepNumber: 'asc' },
    });
    res.json(steps);
  } catch (error) { next(error); }
};

export const setFollowUpSteps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { steps } = req.body;

    if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps must be an array' });

    await prisma.followUpStep.deleteMany({ where: { campaignId: id } });
    const created = await Promise.all(
      steps.map((step: any) =>
        prisma.followUpStep.create({
          data: { campaignId: id, stepNumber: step.stepNumber, delayDays: step.delayDays },
        })
      )
    );

    res.status(201).json(created);
  } catch (error) { next(error); }
};

export const deleteFollowUpStep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const stepId = req.params.stepId as string;
    await prisma.followUpStep.deleteMany({ where: { id: stepId, campaignId: id } });
    res.status(204).send();
  } catch (error) { next(error); }
};

const CAMPAIGN_UPDATABLE_FIELDS = ['name', 'description', 'context', 'reference', 'senderName'] as const;

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

export const getCampaignDrafts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const drafts = await prisma.draft.findMany({
      where: { campaignId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(drafts);
  } catch (error) { next(error); }
};

const DRAFT_UPDATABLE_FIELDS = ['subject', 'body', 'isActive'] as const;

export const updateDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const draftId = req.params.draftId as string;
    const data: Record<string, any> = {};
    for (const field of DRAFT_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    const result = await prisma.draft.updateMany({ where: { id: draftId, campaignId }, data });
    if (result.count === 0) return res.status(404).json({ error: 'Draft not found on this campaign' });
    const updated = await prisma.draft.findUnique({ where: { id: draftId } });
    res.json(updated);
  } catch (error) { next(error); }
};

export const deleteDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const draftId = req.params.draftId as string;
    await prisma.draft.deleteMany({ where: { id: draftId, campaignId } });
    res.status(204).send();
  } catch (error) { next(error); }
};

export const createCustomDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const { subject, body } = req.body;
    const draft = await prisma.draft.create({
      data: {
        userId: req.user!.id,
        campaignId,
        subject,
        body,
        tone: 'custom',
        useCase: 'initial',
      },
    });
    res.status(201).json(draft);
  } catch (error) { next(error); }
};

export const generateCampaignDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const draftData = await aiService.generateDraft(
      'professional',
      'initial',
      campaign.context,
      campaign.reference
    );

    const draft = await prisma.draft.create({
      data: {
        userId: req.user!.id,
        campaignId,
        subject: draftData.subject,
        body: draftData.body,
        tone: 'professional',
        useCase: 'initial',
      },
    });

    res.status(201).json(draft);
  } catch (error) { next(error); }
};

export const generateStepDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const stepNumber = req.params.stepNumber as string;
    const stepNum = parseInt(stepNumber, 10);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const draftData = await aiService.generateDraft(
      'professional',
      'followup',
      campaign.context,
      campaign.reference,
      undefined,
      undefined,
      undefined,
      stepNum
    );

    const draft = await prisma.draft.create({
      data: {
        userId: req.user!.id,
        campaignId,
        subject: draftData.subject,
        body: draftData.body,
        tone: 'professional',
        useCase: 'followup',
        stepNumber: stepNum,
      },
    });

    res.status(201).json(draft);
  } catch (error) { next(error); }
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