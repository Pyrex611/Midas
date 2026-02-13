import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

const campaignService = new CampaignService();

/**
 * POST /api/campaigns
 * Create a new campaign.
 */
export const createCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, context, leadIds } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const campaign = await campaignService.createCampaign(
      name,
      description,
      context,
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

/**
 * POST /api/campaigns/:id/leads
 * Add leads to an existing campaign.
 */
export const addLeadsToCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { leadIds } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non‑empty array' });
    }

    await campaignService.addLeadsToCampaign(id, leadIds);
    res.json({
      success: true,
      message: `${leadIds.length} leads added to campaign`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns
 * List all campaigns.
 */
export const getCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaigns = await campaignService.getCampaigns();
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:id
 * Get detailed campaign information.
 */
export const getCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const campaign = await campaignService.getCampaignDetails(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:campaignId/leads/:leadId/preview
 * Get the personalised email for a lead in a campaign (without sending).
 */
export const getLeadEmailPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { campaignId, leadId } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        drafts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const draft = campaign.drafts[0];
    if (!draft) {
      return res.status(404).json({ error: 'No draft found for this campaign' });
    }

    const { subject, body } = personalisationService.personalise(
      lead as any,
      draft.subject,
      draft.body
    );

    res.json({
      leadId: lead.id,
      campaignId: campaign.id,
      subject,
      body,
      draftId: draft.id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/leads/:leadId/send
 * Send the personalised email for a lead in a campaign immediately.
 */
export const sendLeadEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { campaignId, leadId } = req.params;

    const [lead, campaign] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          drafts: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const draft = campaign.drafts[0];
    if (!draft) {
      return res.status(404).json({ error: 'No active draft found for this campaign' });
    }

    // Check if email already sent for this lead + campaign
    const existing = await prisma.outboundEmail.findFirst({
      where: {
        leadId,
        campaignId,
        status: 'SENT',
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'Email already sent to this lead' });
    }

    // Personalise
    const { subject, body } = personalisationService.personalise(
      lead as any,
      draft.subject,
      draft.body
    );

    // Send email
    const result = await emailService.sendEmail(
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body
    );

    if (!result.success) {
      throw new Error(result.error || 'Email sending failed');
    }

    // Record OutboundEmail
    const outbound = await prisma.outboundEmail.create({
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

    // Update lead outreach status
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        outreachStatus: 'SENT',
        status: 'CONTACTED',
      },
    });

    // Increment draft sent count
    await prisma.draft.update({
      where: { id: draft.id },
      data: { sentCount: { increment: 1 } },
    });

    logger.info({ leadId, campaignId, messageId: result.messageId }, 'Email sent manually via preview');

    res.json({
      success: true,
      message: 'Email sent successfully',
      previewUrl: result.previewUrl,
      outboundId: outbound.id,
    });
  } catch (error) {
    logger.error({ error, leadId, campaignId }, 'Failed to send email from preview');
    next(error);
  }
};