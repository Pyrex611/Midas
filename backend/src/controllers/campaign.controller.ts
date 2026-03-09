import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { DraftService } from '../services/draft.service';
import { personalisationService } from '../services/personalisation.service';
import { emailService } from '../services/email.service';
import { aiService } from '../services/ai.service';
import { promptManager } from '../services/promptManager.service';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';

const campaignService = new CampaignService();
const draftService = new DraftService();

/**
 * POST /api/campaigns
 * Create a new campaign.
 */
export const createCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    logger.debug({ userId }, 'Creating campaign for user');

    const { name, description, context, reference, senderName, leadIds, autoReplyEnabled, sendHourUTC } = req.body;
    if (!name) return res.status(400).json({ error: 'Campaign name is required' });

    const campaign = await campaignService.createCampaign(
      userId,
      name,
      description,
      context,
      reference,
      senderName,
      leadIds,
      autoReplyEnabled,
      sendHourUTC
    );

    res.status(201).json({
      success: true,
      campaignId: campaign.id,
      message: leadIds?.length ? `Campaign started with ${leadIds.length} leads` : 'Campaign created',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:id/leads
 * Add leads to an existing campaign.
 */
export const addLeadsToCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non‑empty array' });
    }

    const result = await campaignService.addLeadsToCampaign(userId, id, leadIds);
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
 * List all campaigns for the authenticated user.
 */
export const getCampaigns = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const campaigns = await campaignService.getCampaigns(userId);
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:id
 * Get detailed campaign information.
 */
export const getCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const campaign = await campaignService.getCampaignDetails(userId, id);
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
export const getLeadEmailThread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;
    const userId = req.user!.id;

    const emails = await prisma.outboundEmail.findMany({
      where: {
        userId,
        campaignId,
        leadId,
      },
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
        logger.info({ messageId: email.messageId }, 'Backfilled analysis for old reply');
      } catch (err) {
        logger.error({ err, emailId: email.id }, 'Failed to analyze old reply');
      }
    }

    const updatedEmails = await prisma.outboundEmail.findMany({
      where: {
        userId,
        campaignId,
        leadId,
      },
      orderBy: { sentAt: 'asc' },
    });

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
export const previewLeadWithDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId, draftId } = req.params;
    const userId = req.user!.id;

    const [lead, campaign, draft] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, userId } }),
      prisma.campaign.findFirst({ where: { id: campaignId, userId } }),
      prisma.draft.findFirst({ where: { id: draftId, userId } }),
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
 * Queue the personalised email for a lead in a campaign for sending.
 */
export const sendLeadEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;
    const userId = req.user!.id;

    const [lead, campaign] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, userId } }),
      prisma.campaign.findFirst({
        where: { id: campaignId, userId },
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

    // Queue the email
    await emailService.queueEmail(userId, leadId, campaignId, draft.id, subject, body);
    await prisma.lead.update({
      where: { id: leadId },
      data: { outreachStatus: 'QUEUED' },
    });

    logger.info({ leadId, campaignId }, 'Email queued (manual)');
    res.json({ success: true, message: 'Email queued' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:campaignId/leads/:leadId/reply-draft
 * Get the persisted reply draft for a lead.
 */
export const getReplyDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;
    const userId = req.user!.id;
    const draft = await draftService.getReplyDraft(leadId, campaignId);
    if (!draft) return res.status(404).json({ error: 'No reply draft found' });
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

/**
 * POST /api/campaigns/:campaignId/leads/:leadId/generate-reply-draft
 * Generate and persist a reply draft.
 */
export const generateReplyDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;
    const userId = req.user!.id;

    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const latestReply = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });
    if (!latestReply || !latestReply.analysis) {
      return res.status(400).json({ error: 'No reply with analysis found for this lead' });
    }

    const analysis = JSON.parse(latestReply.analysis);
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });

    const params = {
      useCase: 'reply' as const,
      tone: 'professional',
      campaignContext: campaign?.context,
      reference: campaign?.reference,
      companyContext: null,
      originalEmail: latestReply.body,
      originalSubject: latestReply.subject,
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

    const savedDraft = await draftService.createReplyDraft(
      userId,
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
 * POST /api/campaigns/:campaignId/leads/:leadId/send-reply-draft
 * Send the reply draft immediately (bypasses queue).
 */
export const sendReplyDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campaignId, leadId } = req.params;
    const { subject, body } = req.body;
    const userId = req.user!.id;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const latestIncoming = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });
    if (!latestIncoming) {
      return res.status(400).json({ error: 'No original incoming email found to reply to' });
    }

    const { subject: personalisedSubject, body: personalisedBody } = personalisationService.personalise(
      lead as any,
      subject,
      body,
      campaign.reference,
      campaign.senderName
    );

    // ✅ SEND IMMEDIATELY – bypass queue
    const result = await emailService.sendEmailNow(
      userId,
      lead.email,
      personalisedSubject,
      personalisedBody.replace(/\n/g, '<br>'),
      personalisedBody,
      campaign.senderName,
      latestIncoming.messageId
    );

    if (!result.success) throw new Error(result.error || 'Email sending failed');

    // Record the sent reply
    await prisma.outboundEmail.create({
      data: {
        userId,
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

    // Delete the reply draft after sending
    await draftService.deleteReplyDraft(leadId, campaignId);

    logger.info({ leadId, campaignId, messageId: result.messageId }, 'Reply sent immediately');
    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/campaigns/:id/followup
 * Update follow‑up settings (legacy).
 */
export const updateFollowUpSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { followUpEnabled, followUpDelay } = req.body;
    if (typeof followUpEnabled !== 'boolean') {
      return res.status(400).json({ error: 'followUpEnabled must be a boolean' });
    }
    const updated = await campaignService.updateFollowUpSettings(userId, id, followUpEnabled, followUpDelay);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/campaigns/:id/auto-reply
 * Update auto‑reply setting.
 */
export const updateAutoReply = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { autoReplyEnabled } = req.body;
    if (typeof autoReplyEnabled !== 'boolean') {
      return res.status(400).json({ error: 'autoReplyEnabled must be a boolean' });
    }
    const updated = await campaignService.updateAutoReplySettings(userId, id, autoReplyEnabled);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:id/followup-steps
 * Retrieve all follow‑up steps for a campaign.
 */
export const getFollowUpSteps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const steps = await campaignService.getFollowUpSteps(userId, id);
    res.json(steps);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:id/followup-steps
 * Replace all follow‑up steps for a campaign and generate missing drafts.
 */
export const setFollowUpSteps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { steps } = req.body; // expected array of { stepNumber, delayDays, draftId? }

    if (!Array.isArray(steps)) {
      return res.status(400).json({ error: 'steps must be an array' });
    }

    // First, get the campaign to have context for draft generation
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      select: {
        context: true,
        reference: true,
        senderName: true,
      },
    });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Replace all steps (this deletes old ones and creates new ones)
    const createdSteps = await campaignService.setFollowUpSteps(userId, id, steps);

    // For each created step that does not have a draftId, generate a new follow‑up draft (only one)
		const stepsWithDrafts = await Promise.all(
			createdSteps.map(async (step) => {
				if (!step.draftId) {
					try {
						// Generate exactly 3 draft for this step
						const drafts = await draftService.generateFollowUpDrafts(
							userId,
							id,
							campaign.context || undefined,
							campaign.reference || undefined,
							campaign.senderName || undefined,
							step.stepNumber,
							3 // count
						);
						if (drafts && drafts.length > 0) {
							const updatedStep = await prisma.followUpStep.update({
								where: { id: step.id },
								data: { draftId: drafts[0].id },
								include: { draft: true },
							});
							return updatedStep;
						} else {
							logger.warn({ stepId: step.id }, 'No draft generated for follow‑up step');
							return step;
						}
					} catch (error) {
						logger.error({ error, stepId: step.id }, 'Failed to generate draft for follow‑up step');
						return step;
					}
				}
				// If step already has draftId, fetch it
				const stepWithDraft = await prisma.followUpStep.findUnique({
					where: { id: step.id },
					include: { draft: true },
				});
				return stepWithDraft;
			})
		);

    res.status(201).json(stepsWithDrafts);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/campaigns/:id/followup-steps/:stepId
 * Delete a specific follow‑up step.
 */
export const deleteFollowUpStep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { stepId } = req.params;
    await campaignService.deleteFollowUpStep(userId, stepId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/campaigns/:id/send-hour
 * Update the campaign's send hour (UTC).
 */
export const updateSendHour = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { sendHourUTC } = req.body;
    if (typeof sendHourUTC !== 'number' || sendHourUTC < 0 || sendHourUTC > 23) {
      return res.status(400).json({ error: 'sendHourUTC must be a number between 0 and 23' });
    }
    const updated = await campaignService.updateSendHour(userId, id, sendHourUTC);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/campaigns/:id
 * Update campaign details (rename, sender name, etc.).
 */
export const updateCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, context, reference, senderName } = req.body;

    const campaign = await prisma.campaign.findFirst({ where: { id, userId } });
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
export const deleteCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const campaign = await prisma.campaign.findFirst({ where: { id, userId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
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
export const getCampaignDrafts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;
    const drafts = await prisma.draft.findMany({
      where: { campaignId, isActive: true, userId },
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
export const updateDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
export const deleteDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
export const createCustomDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'Subject and body required' });
    const draft = await draftService.createCustomDraft(userId, subject, body, campaignId, 'custom');
    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:campaignId/drafts/generate
 * Generate a new AI draft for the campaign.
 */
export const generateCampaignDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];

    const draft = await draftService.generateAndSaveDraft(
      userId,
      randomTone,
      'initial',
      campaignId,
      campaign.context || undefined,
      campaign.reference || undefined,
      undefined,
      campaign.senderName || undefined
    );

    if (!draft) {
      return res.status(500).json({ error: 'Failed to generate draft' });
    }

    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/campaigns/:id/active-hours
 * Update campaign's active sending hours.
 */
export const updateActiveHours = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { activeStartHour, activeEndHour, timezone } = req.body;

    if (activeStartHour !== undefined && (activeStartHour < 0 || activeStartHour > 23)) {
      return res.status(400).json({ error: 'activeStartHour must be 0-23' });
    }
    if (activeEndHour !== undefined && (activeEndHour < 0 || activeEndHour > 23)) {
      return res.status(400).json({ error: 'activeEndHour must be 0-23' });
    }

    const updated = await campaignService.updateActiveHours(
      userId,
      id,
      activeStartHour,
      activeEndHour,
      timezone
    );
    res.json(updated);
  } catch (error) {
    next(error);
  }
};