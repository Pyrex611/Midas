import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import { aiService } from '../services/ai.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';

export const createCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name, description, context, reference, senderName, leadIds, autoReplyEnabled, sendHourUTC } = req.body;
    if (!name) return res.status(400).json({ error: 'Campaign name is required' });

    const campaign = await prisma.campaign.create({
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
        ...(leadIds?.length && {
          leads: { connect: leadIds.map((lid: string) => ({ id: lid })) },
        }),
      },
    });

    if (leadIds?.length) {
      await prisma.lead.updateMany({
        where: { id: { in: leadIds }, userId },
        data: { outreachStatus: 'PENDING', campaignId: campaign.id },
      });
    }

    for (let i = 0; i < 5; i++) {
      const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
      const draft = await aiService.generateDraft(
        tones[i % tones.length],
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
          campaignId: campaign.id,
          subject: draft.subject,
          body: draft.body,
          tone: tones[i % tones.length],
          useCase: 'initial',
        },
      });
    }

    await prisma.followUpStep.create({
      data: {
        campaignId: campaign.id,
        stepNumber: 1,
        delayDays: 3,
      },
    });

    res.status(201).json({
      success: true,
      campaignId: campaign.id,
      message: leadIds?.length ? `Campaign started with ${leadIds.length} leads` : 'Campaign created',
    });
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
      where: { id, userId },
      include: { leads: { select: { id: true } } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const existingLeadIds = new Set(campaign.leads.map(l => l.id));
    const newLeadIds = leadIds.filter(lid => !existingLeadIds.has(lid));

    if (newLeadIds.length === 0) {
      return res.json({ added: 0, skipped: leadIds.length });
    }

    await prisma.lead.updateMany({
      where: { id: { in: newLeadIds }, userId },
      data: { campaignId: id, outreachStatus: 'PENDING' },
    });

    if (campaign.status === 'DRAFT') {
      await prisma.campaign.update({
        where: { id },
        data: { status: 'ACTIVE', startedAt: new Date() },
      });
    }

    res.json({ added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length });
  } catch (error) {
    next(error);
  }
};

export const getCampaigns = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { leads: true, emails: true, drafts: true },
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
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
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
      where: { userId, campaignId: id, status: 'PENDING' },
    });

    res.json({ ...campaign, queuedCount });
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
      where: { userId, campaignId, leadId },
      orderBy: { sentAt: 'asc' },
    });

    const unanalyzed = emails.filter(e => e.isIncoming && !e.analysis);
    for (const email of unanalyzed) {
      try {
        const analysis = await aiService.analyzeReply(email.body);
        await prisma.outboundEmail.update({
          where: { id: email.id },
          data: {
            sentiment: analysis.sentiment,
            intent: analysis.intent,
            analysis: JSON.stringify(analysis),
          },
        });
      } catch (err) {
        logger.error({ err, emailId: email.id }, 'Failed to analyze reply thread');
      }
    }

    const updatedEmails = await prisma.outboundEmail.findMany({
      where: { userId, campaignId, leadId },
      orderBy: { sentAt: 'asc' },
    });

    const emailsWithParsedAnalysis = updatedEmails.map(email => ({
      ...email,
      analysis: email.analysis ? JSON.parse(email.analysis) : null,
    }));

    res.json(emailsWithParsedAnalysis);
  } catch (error) {
    next(error);
  }
};

export const previewLeadWithDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const draftId = req.params.draftId as string;
    const userId = req.user!.id;

    const [lead, campaign, draft] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, userId } }),
      prisma.campaign.findFirst({ where: { id: campaignId, userId } }),
      prisma.draft.findFirst({ where: { id: draftId, userId } }),
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
      prisma.lead.findFirst({ where: { id: leadId, userId } }),
      prisma.campaign.findFirst({
        where: { id: campaignId, userId },
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

    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const latestReply = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });
    if (!latestReply) return res.status(400).json({ error: 'No incoming reply found' });

    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    const analysis = latestReply.analysis ? JSON.parse(latestReply.analysis) : { sentiment: 'neutral' };

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

    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } });
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
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
      where: { id, userId: req.user!.id },
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
      where: { id, userId: req.user!.id },
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
      where: { id, userId: req.user!.id },
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
      where: { id, userId: req.user!.id },
      data: req.body,
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const deleteCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.campaign.delete({ where: { id, userId: req.user!.id } });
    res.status(204).send();
  } catch (error) { next(error); }
};

export const getCampaignDrafts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const drafts = await prisma.draft.findMany({
      where: { campaignId, userId: req.user!.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(drafts);
  } catch (error) { next(error); }
};

export const updateDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const draftId = req.params.draftId as string;
    const updated = await prisma.draft.update({
      where: { id: draftId, userId: req.user!.id },
      data: req.body,
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const deleteDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const draftId = req.params.draftId as string;
    await prisma.draft.delete({ where: { id: draftId, userId: req.user!.id } });
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
    const userId = req.user!.id;
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const draftData = await aiService.generateDraft(
      'professional',
      'initial',
      campaign.context,
      campaign.reference
    );

    const draft = await prisma.draft.create({
      data: {
        userId,
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
    const userId = req.user!.id;
    const stepNum = parseInt(stepNumber, 10);

    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
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
        userId,
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
    const link = await prisma.campaignDomain.create({
      data: { campaignId: id, domainId },
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