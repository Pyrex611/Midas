import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import { aiService } from '../services/ai.service';
import { emailQueueService } from '../services/emailQueue.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';
import { CampaignRequest } from '../middleware/campaignAccess.middleware';
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from '../lib/unsubscribe';

export const createCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name, description, context, reference, senderName, leadIds, autoReplyEnabled, sendHourUTC, objective, targetTool, extendedObjective } = req.body;
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

    // Generate the 5 tonal drafts with a small delay between calls so we don't
    // hammer the configured AI provider's rate limit, and so this request
    // doesn't need to hold open 5 back-to-back LLM round-trips with zero gap.
    const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
    const requestDelayMs = Number(process.env.AI_REQUEST_DELAY_MS) || 500;
    const createdDrafts = [];
    for (let i = 0; i < 5; i++) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, requestDelayMs));
      const draft = await aiService.generateDraft(
        tones[i % tones.length],
        'initial',
        context,
        reference,
        undefined,
        undefined,
        undefined
      );
      const savedDraft = await prisma.draft.create({
        data: {
          userId,
          campaignId: campaign.id,
          subject: draft.subject,
          body: draft.body,
          tone: tones[i % tones.length],
          useCase: 'initial',
        },
      });
      createdDrafts.push(savedDraft);
    }

    await prisma.followUpStep.create({
      data: {
        campaignId: campaign.id,
        stepNumber: 1,
        delayDays: 3,
      },
    });

    // Auto-queue initial outreach emails when starting campaign with leads
    if (leadIds?.length && createdDrafts.length > 0) {
      await prisma.lead.updateMany({
        where: { id: { in: leadIds }, userId },
        data: { outreachStatus: 'PENDING', campaignId: campaign.id },
      });

      const initialDraft = createdDrafts[0];
      const pendingRecords = leadIds.map((leadId: string) => ({
        userId,
        campaignId: campaign.id,
        leadId,
        draftId: initialDraft.id,
        subject: initialDraft.subject,
        body: initialDraft.body,
        status: 'PENDING',
        priority: 1,
        scheduledAt: new Date(),
      }));

      await prisma.pendingEmail.createMany({
        data: pendingRecords,
      });

      // Opportunistic trigger: don't wait on the next cron tick for the first
      // batch to start moving — kick the queue right now too. Safe to call
      // concurrently with any scheduled/external trigger (see emailQueue.service.ts).
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

    // Resolve an explicit `role` per campaign (OWNER if they created it,
    // otherwise their membership row) so the frontend can gate UI per-campaign
    // instead of showing every action to every collaborator.
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
    // Access already verified by requireCampaignRole('VIEWER') middleware.
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
          },
        },
        drafts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        emails: {
          orderBy: { sentAt: 'desc' },
          take: 100,
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

    const queuedCount = await prisma.pendingEmail.count({
      where: { campaignId: id, status: 'PENDING' },
    });

    res.json({ ...campaign, queuedCount, role: req.campaignRole });
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

    // Access already verified by requireCampaignRole('EDITOR'). Only need the
    // leads relation here, which the middleware's lightweight fetch doesn't include.
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { leads: { select: { id: true } } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const existingLeadIds = new Set(campaign.leads.map(l => l.id));
    const newLeadIds = leadIds.filter(lid => !existingLeadIds.has(lid));

    if (newLeadIds.length === 0) {
      return res.json({ added: 0, skipped: leadIds.length });
    }

    await prisma.lead.updateMany({
      where: { id: { in: newLeadIds } },
      data: { campaignId: id, outreachStatus: 'PENDING' },
    });

    if (campaign.status === 'DRAFT') {
      await prisma.campaign.update({
        where: { id },
        data: { status: 'ACTIVE', startedAt: new Date() },
      });
    }

    // Auto-generate queue records for newly added leads
    const initialDraft = await prisma.draft.findFirst({
      where: { campaignId: id, isActive: true, useCase: 'initial' },
      orderBy: { createdAt: 'asc' },
    });

    if (initialDraft) {
      const pendingRecords = newLeadIds.map((leadId: string) => ({
        userId,
        campaignId: id,
        leadId,
        draftId: initialDraft.id,
        subject: initialDraft.subject,
        body: initialDraft.body,
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

    res.json({ added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length });
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
    // Role floor (EDITOR) already enforced by requireCampaignRole('EDITOR') middleware.

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
    // Role floor (EDITOR) already enforced by requireCampaignRole('EDITOR') middleware.

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
      unsubscribeUrl
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
    // Prefer a sender on the SAME domain the original thread was sent from, for continuity.
    const activeSender = activeSenders.find(s => s.domainId === latestIncoming?.domainId) || activeSenders[0];

    const { subject: pSubject, body: pBody } = personalisationService.personalise(
      lead,
      subject,
      body,
      campaign.reference,
      activeSender.displayName || campaign.senderName
      // No unsubscribe footer on manual replies — this is a reply within an
      // already-engaged conversation, not a cold outbound send.
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
      latestIncoming?.messageId
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
    // Note: :stepId belongs to the :id campaign already authorized by the
    // middleware, but we still scope the delete by campaignId defensively
    // so a stepId from a *different* campaign can never be deleted via this URL.
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
    // Whitelist fields — `data: req.body` previously allowed a caller to set
    // ANY campaign column (userId, status, autoReplyEnabled, etc.) via this route.
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
    // Scope by campaignId (already authorized) so a draftId from another
    // campaign can't be edited through this URL.
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

    // The sender itself must belong to the caller — otherwise any editor
    // could attach someone else's mailbox to their campaign.
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
