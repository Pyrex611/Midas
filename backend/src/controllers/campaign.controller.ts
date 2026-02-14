import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { DraftService } from '../services/draft.service'; // ✅ IMPORT FIX
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

const campaignService = new CampaignService();
const draftService = new DraftService();

export const createCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, context, reference, leadIds } = req.body;
    if (!name) return res.status(400).json({ error: 'Campaign name is required' });

    const campaign = await campaignService.createCampaign(
      name,
      description,
      context,
      reference,
      leadIds
    );

    res.status(201).json({
      success: true,
      campaignId: campaign.id,
      message: leadIds?.length
        ? `Campaign started with ${leadIds.length} leads`
        : 'Campaign created',
    });
  } catch (error) {
    next(error);
  }
};

export const addLeadsToCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non‑empty array' });
    }

    const result = await campaignService.addLeadsToCampaign(id, leadIds);
    res.json({
      success: true,
      message: `${result.added} leads added to campaign (${result.skipped} already present)`,
    });
  } catch (error) {
    next(error);
  }
};

export const getCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await campaignService.getCampaigns();
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

export const getCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const campaign = await campaignService.getCampaignDetails(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (error) {
    next(error);
  }
};

export const getLeadEmailPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const draft = campaign.drafts[0];
    if (!draft) return res.status(404).json({ error: 'No draft found for this campaign' });

    const { subject, body } = personalisationService.personalise(
      lead as any,
      draft.subject,
      draft.body,
      campaign.reference
    );

    res.json({ leadId, campaignId, subject, body, draftId: draft.id });
  } catch (error) {
    next(error);
  }
};

export const sendLeadEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;

    const [lead, campaign] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
    ]);

    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const draft = campaign.drafts[0];
    if (!draft) return res.status(404).json({ error: 'No active draft found' });

    const existing = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, status: 'SENT' },
    });
    if (existing) return res.status(409).json({ error: 'Email already sent to this lead' });

    const { subject, body } = personalisationService.personalise(
      lead as any,
      draft.subject,
      draft.body,
      campaign.reference
    );

    const result = await emailService.sendEmail(
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body
    );
    if (!result.success) throw new Error(result.error || 'Email sending failed');

    await prisma.outboundEmail.create({
      data: {
        leadId,
        campaignId,
        draftId: draft.id,
        subject,
        body,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { outreachStatus: 'SENT', status: 'CONTACTED' },
    });
    await prisma.draft.update({
      where: { id: draft.id },
      data: { sentCount: { increment: 1 } },
    });

    logger.info({ leadId, campaignId, messageId: result.messageId }, 'Email sent manually via preview');
    res.json({ success: true, message: 'Email sent successfully', previewUrl: result.previewUrl });
  } catch (error) {
    next(error);
  }
};

// 🔹 NEW: Update campaign (rename only – but can also update description/context/reference if needed)
export const updateCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, context, reference } = req.body;

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: name ?? campaign.name,
        description: description ?? campaign.description,
        context: context ?? campaign.context,
        reference: reference ?? campaign.reference,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// 🔹 NEW: Delete campaign
export const deleteCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.campaign.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:campaignId/drafts
 * Get all active drafts for a campaign.
 */
export const getCampaignDrafts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.params;
    const drafts = await prisma.draft.findMany({
      where: {
        campaignId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(drafts);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:campaignId/leads/:leadId/preview/:draftId
 * Preview a specific draft for a lead (used in manual selection).
 */
export const previewLeadWithDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId, draftId } = req.params;

    const [lead, campaign, draft] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.draft.findUnique({ where: { id: draftId } }),
    ]);

    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    const { subject, body } = personalisationService.personalise(
      lead as any,
      draft.subject,
      draft.body,
      campaign.reference
    );

    res.json({ leadId, campaignId, draftId, subject, body });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/drafts/generate
 * Generate a new draft for the campaign (already exists, but fix import).
 */
export const generateCampaignDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.params;
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];

    const draft = await draftService.generateAndSaveDraft(
      randomTone,
      'initial',
      campaignId,
      campaign.context || undefined,
      campaign.reference || undefined
    );

    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
};