import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import { aiService } from '../services/ai.service';
import { emailQueueService } from '../services/emailQueue.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';

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

    // Generate Initial Draft Variations
    const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
    const createdDrafts = [];
    for (let i = 0; i < 5; i++) {
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

    // Create Initial Follow-Up Sequence Step
    await prisma.followUpStep.create({
      data: {
        campaignId: campaign.id,
        stepNumber: 1,
        delayDays: 3,
      },
    });

    // AUTOMATIC INITIAL QUEUE DISPATCH FOR ATTACHED LEADS
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
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

export const getCampaignDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    
    const isMember = await prisma.campaignMember.findFirst({
      where: { campaignId: id, userId },
    });

    const isCreator = await prisma.campaign.findFirst({
      where: { id, userId },
    });

    if (!isMember && !isCreator) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this campaign' });
    }

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
        domainLinks: {
          include: { domain: true },
        },
      },
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const queuedCount = await prisma.pendingEmail.count({
      where: { campaignId: id, status: 'PENDING' },
    });

    res.json({ ...campaign, queuedCount });
  } catch (error) {
    next(error);
  }
};

export const addLeadsToCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non-empty array' });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id, OR: [{ userId }, { members: { some: { userId } } }] },
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

    // AUTOMATIC QUEUE INJECTION FOR NEWLY ADDED LEADS
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
        logger.error({ err }, 'Background queue execution error');
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

export const createInvite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const senderId = req.user!.id;
    const campaignId = req.params.id;
    const { email, role } = req.body;

    if (!email) return res.status(400).json({ error: 'Email address is required' });

    const membership = await prisma.campaignMember.findFirst({
      where: { campaignId, userId: senderId },
    });

    if (!membership || membership.role === 'VIEWER') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to invite collaborators.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.campaignInvite.create({
      data: {
        campaignId,
        senderId,
        email: email.toLowerCase().trim(),
        role: role || 'EDITOR',
        token,
        expiresAt,
      },
    });

    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
};

export const updateCampaignStrategy = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user!.id;
    const { objective, targetTool, extendedObjective } = req.body;

    const membership = await prisma.campaignMember.findFirst({
      where: { campaignId, userId },
    });

    if (!membership || membership.role === 'VIEWER') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
    }

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
    const userId = req.user!.id;

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
          domainLinks: { include: { domain: true } },
        },
      }),
    ]);

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found' });
    const draft = campaign.drafts[0];
    if (!draft) return res.status(400).json({ error: 'No active draft found' });

    const activeDomain = campaign.domainLinks.map(l => l.domain).find(d => d.status === 'active');
    if (!activeDomain) return res.status(400).json({ error: 'No active domain attached to this campaign' });

    const { subject, body } = personalisationService.personalise(
      lead,
      draft.subject,
      draft.body,
      campaign.reference,
      campaign.senderName
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeDomain.id,
        leadId,
        campaignId,
        draftId: draft.id,
        subject,
        body,
        status: 'PROCESSING',
      },
    });

    const result = await emailService.sendEmailNow(
      activeDomain,
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      campaign.senderName
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
      include: { domainLinks: { include: { domain: true } } },
    });

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found' });

    const activeDomain = campaign.domainLinks.map(l => l.domain).find(d => d.status === 'active');
    if (!activeDomain) return res.status(400).json({ error: 'No active domain found for sending reply' });

    const latestIncoming = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });

    const { subject: pSubject, body: pBody } = personalisationService.personalise(
      lead,
      subject,
      body,
      campaign.reference,
      campaign.senderName
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeDomain.id,
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
      activeDomain,
      lead.email,
      pSubject,
      pBody.replace(/\n/g, '<br>'),
      pBody,
      outboundRecord.id,
      campaign.senderName,
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
      data: { autoReplyEnabled },
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const updateSendHour = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { sendHourUTC } = req.body;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { sendHourUTC },
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
    const stepId = req.params.stepId as string;
    await prisma.followUpStep.delete({ where: { id: stepId } });
    res.status(204).send();
  } catch (error) { next(error); }
};

export const updateCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const updated = await prisma.campaign.update({
      where: { id },
      data: req.body,
    });
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

export const updateDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const draftId = req.params.draftId as string;
    const updated = await prisma.draft.update({
      where: { id: draftId },
      data: req.body,
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const deleteDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const draftId = req.params.draftId as string;
    await prisma.draft.delete({ where: { id: draftId } });
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

export const getCampaignDomains = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const links = await prisma.campaignDomain.findMany({
      where: { campaignId: id },
      include: { domain: true },
    });
    res.json(links.map(l => l.domain));
  } catch (error) { next(error); }
};

export const addDomainToCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { domainId } = req.body;

    const link = await prisma.campaignDomain.upsert({
      where: {
        campaignId_domainId: {
          campaignId: id,
          domainId,
        },
      },
      update: {},
      create: { campaignId: id, domainId },
    });

    res.status(201).json(link);
  } catch (error) { next(error); }
};

export const removeDomainFromCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const domainId = req.params.domainId as string;
    await prisma.campaignDomain.deleteMany({
      where: { campaignId: id, domainId },
    });
    res.status(204).send();
  } catch (error) { next(error); }
};