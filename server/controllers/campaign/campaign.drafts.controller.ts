import { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { aiService } from '../../services/ai.service';
import { complianceService } from '../../services/compliance.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CampaignRequest } from '../../middleware/campaignAccess.middleware';
import { logger } from '../../config/logger';

const DRAFT_UPDATABLE_FIELDS = ['subject', 'body', 'isActive'] as const;

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

    const draftData = await aiService.generateDraft({
      tone: 'professional',
      useCase: 'initial',
      campaignContext: campaign.context,
      reference: campaign.reference,
      userId: campaign.userId || req.user!.id,
    });

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
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to generate campaign draft');
    res.status(400).json({ error: error.message || 'Failed to generate AI draft' });
  }
};

export const generateStepDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const stepNumber = req.params.stepNumber as string;
    const stepNum = parseInt(stepNumber, 10);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const draftData = await aiService.generateDraft({
      tone: 'professional',
      useCase: 'followup',
      campaignContext: campaign.context,
      reference: campaign.reference,
      stepNumber: stepNum,
      userId: campaign.userId || req.user!.id,
    });

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
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to generate step draft' });
  }
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
      } catch {}
    }

    const draftData = await aiService.generateDraft({
      tone: 'professional',
      useCase: 'reply',
      campaignContext: campaign?.context,
      reference: campaign?.reference,
      originalEmail: latestReply.body,
      sentiment: analysis.sentiment,
      userId,
    });

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
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to synthesize reply draft' });
  }
};