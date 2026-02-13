import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { personalisationService } from '../services/personalisation.service';
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

    // Fetch campaign with its most recent active draft
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

    // Personalise the draft for this lead
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