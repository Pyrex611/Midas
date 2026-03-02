import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { DraftService } from '../services/draft.service';
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import { aiService } from '../services/ai.service';
import { promptManager } from '../services/promptManager.service';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

const campaignService = new CampaignService();
const draftService = new DraftService();

/**
 * POST /api/campaigns
 * Create a new campaign.
 */
export const createCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, context, reference, senderName, leadIds } = req.body;
    if (!name) return res.status(400).json({ error: 'Campaign name is required' });

    const campaign = await campaignService.createCampaign(
      name,
      description,
      context,
      reference,
      senderName,
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

/**
 * GET /api/campaigns
 * List all campaigns.
 */
export const getCampaigns = async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /api/campaigns/:campaignId/leads/:leadId/thread
 * Get full email thread for a lead, analyzing any unanalyzed replies.
 */
export const getLeadEmailThread = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;

    const emails = await prisma.outboundEmail.findMany({
      where: {
        campaignId,
        leadId,
      },
      orderBy: { sentAt: 'asc' },
    });

    // Find incoming messages that lack analysis
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
        logger.info({ messageId: email.messageId }, 'Backfilled analysis for old reply');
      } catch (err) {
        logger.error({ err, emailId: email.id }, 'Failed to analyze old reply');
      }
    }

    // Re-fetch after updates
    const updatedEmails = await prisma.outboundEmail.findMany({
      where: {
        campaignId,
        leadId,
      },
      orderBy: { sentAt: 'asc' },
    });

    // Parse analysis JSON
    const emailsWithAnalysis = updatedEmails.map(email => ({
      ...email,
      analysis: email.analysis ? JSON.parse(email.analysis) : null,
    }));

    res.json(emailsWithAnalysis);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:campaignId/leads/:leadId/preview/:draftId
 * Preview a specific draft for a lead.
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
      campaign.reference,
      campaign.senderName
    );

    res.json({ leadId, campaignId, draftId, subject, body });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/leads/:leadId/send
 * Send the personalised email for a lead in a campaign immediately.
 */
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
      campaign.reference,
      campaign.senderName
    );

    const result = await emailService.sendEmail(
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      campaign.senderName
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
        messageId: result.messageId,
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

    logger.info({ leadId, campaignId, messageId: result.messageId }, 'Email sent');
    res.json({ success: true, message: 'Email sent successfully', previewUrl: result.previewUrl });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/leads/:leadId/generate-reply-draft
 * Generate and persist a reply draft with proper threading.
 */
export const generateReplyDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const latestReply = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });
    if (!latestReply || !latestReply.analysis) {
      return res.status(400).json({ error: 'No reply with analysis found for this lead' });
    }

    const analysis = JSON.parse(latestReply.analysis);
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

    const params = {
      useCase: 'reply' as const,
      tone: 'professional',
      campaignContext: campaign?.context,
      reference: campaign?.reference,
      companyContext: null,
      originalEmail: latestReply.body,
      originalSubject: latestReply.subject, // NEW
      recipientName: lead.name,
      recipientCompany: lead.company || undefined,
      sentiment: analysis.sentiment,
    };
    const prompt = promptManager.buildPrompt(params);

    const system = 'You are an expert B2B sales copywriter. Output only valid JSON with "subject" and "body".';
    const raw = await aiService.complete(prompt, system);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const draftData = JSON.parse(jsonMatch[0]);

    // Save to database
    const savedDraft = await draftService.createReplyDraft(
      leadId,
      campaignId,
      draftData.subject,
      draftData.body,
      'professional'
    );

    res.json({
      id: savedDraft.id,
      subject: savedDraft.subject,
      body: savedDraft.body,
      isIncoming: false,
      isDraft: true,
      sentAt: savedDraft.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/campaigns/:id
 * Update campaign details.
 */
export const updateCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, context, reference, senderName } = req.body;

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: name ?? campaign.name,
        description: description ?? campaign.description,
        context: context ?? campaign.context,
        reference: reference ?? campaign.reference,
        senderName: senderName ?? campaign.senderName,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign.
 */
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
      where: { campaignId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(drafts);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/campaigns/:campaignId/drafts/:draftId
 * Update a draft.
 */
export const updateDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { draftId } = req.params;
    const { subject, body, tone } = req.body;
    const updated = await draftService.updateDraft(draftId, { subject, body, tone });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/campaigns/:campaignId/drafts/:draftId
 * Delete a draft.
 */
export const deleteDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { draftId } = req.params;
    await draftService.deleteDraft(draftId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/drafts/custom
 * Create a custom draft.
 */
export const createCustomDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.params;
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'Subject and body required' });
    const draft = await draftService.createCustomDraft(subject, body, campaignId, 'custom');
    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/drafts/generate
 * Generate a new AI draft for the campaign.
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
      campaign.reference || undefined,
      undefined,
      campaign.senderName || undefined
    );

    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/leads/:leadId/send-reply-draft
 * Send the reply draft after personalising it.
 */
export const sendReplyDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;
    const { subject, body } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const latestIncoming = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });
    if (!latestIncoming) {
      return res.status(400).json({ error: 'No original incoming email found to reply to' });
    }

    // PERSONALISE the reply draft using lead and campaign data
    const { subject: personalisedSubject, body: personalisedBody } = personalisationService.personalise(
      lead as any,
      subject,
      body,
      campaign.reference,
      campaign.senderName
    );

    // Send email with In-Reply-To header
    const result = await emailService.sendEmail(
      lead.email,
      personalisedSubject,
      personalisedBody.replace(/\n/g, '<br>'),
      personalisedBody,
      campaign.senderName,
      latestIncoming.messageId // pass the original messageId as inReplyTo
    );
    if (!result.success) throw new Error(result.error || 'Email sending failed');

    // Create outbound email record, linking to the original incoming
    await prisma.outboundEmail.create({
      data: {
        leadId,
        campaignId,
        subject: personalisedSubject,
        body: personalisedBody,
        isIncoming: false,
        messageId: result.messageId,
        replyToId: latestIncoming.id,
        sentAt: new Date(),
        status: 'SENT',
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { outreachStatus: 'SENT', status: 'CONTACTED' },
    });

    // Delete the reply draft
    await draftService.deleteReplyDraft(leadId, campaignId);

    logger.info({ leadId, campaignId, messageId: result.messageId }, 'Reply sent');
    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:campaignId/leads/:leadId/reply-draft
 * Get the persisted reply draft for a lead.
 */
export const getReplyDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;
    const draft = await draftService.getReplyDraft(leadId, campaignId);
    if (!draft) {
      return res.status(404).json({ error: 'No reply draft found' });
    }
    res.json({
      id: draft.id,
      subject: draft.subject,
      body: draft.body,
      isIncoming: false,
      isDraft: true,
      sentAt: draft.createdAt,
    });
  } catch (error) {
    next(error);
  }
};