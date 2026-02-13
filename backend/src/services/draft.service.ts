import prisma from '../lib/prisma';
import { aiService } from './ai.service';
import { logger } from '../config/logger';

export class DraftService {
  /**
   * Generate a single draft and save it to the database.
   */
  async generateAndSaveDraft(
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignId?: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    try {
      const { subject, body } = await aiService.generateDraft(
        tone,
        useCase,
        campaignContext,
        reference,
        companyContext
      );

      const draft = await prisma.draft.create({
        data: {
          subject,
          body,
          tone,
          useCase,
          version: 1,
          isActive: true,
          campaignId,
        },
      });

      logger.info({ draftId: draft.id, campaignId }, 'New draft generated and saved');
      return draft;
    } catch (error) {
      logger.error({ error }, 'Failed to generate draft');
      throw error;
    }
  }

  /**
   * Generate multiple drafts with varied tones.
   */
  async generateMultipleDrafts(
    count: number,
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignId?: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
    const drafts = [];

    for (let i = 0; i < count; i++) {
      const variedTone = tones[i % tones.length];
      const variedContext = campaignContext
        ? `${campaignContext} (Version ${i + 1}: ${variedTone} approach)`
        : undefined;

      const draft = await this.generateAndSaveDraft(
        variedTone,
        useCase,
        campaignId,
        variedContext,
        reference,
        companyContext
      );
      drafts.push(draft);
    }

    logger.info({ campaignId, count }, 'Generated multiple drafts');
    return drafts;
  }

  /**
   * Get a random active draft for a given campaign and use case.
   * Falls back to global drafts if none exist for the campaign.
   */
  async getRandomDraft(campaignId: string, useCase: string = 'initial') {
    const campaignDrafts = await prisma.draft.findMany({
      where: {
        campaignId,
        useCase,
        isActive: true,
      },
    });

    if (campaignDrafts.length > 0) {
      const randomIndex = Math.floor(Math.random() * campaignDrafts.length);
      return campaignDrafts[randomIndex];
    }

    // Fallback to global drafts
    const globalDrafts = await prisma.draft.findMany({
      where: {
        campaignId: null,
        useCase,
        isActive: true,
      },
    });

    if (globalDrafts.length > 0) {
      const randomIndex = Math.floor(Math.random() * globalDrafts.length);
      return globalDrafts[randomIndex];
    }

    // If no drafts exist, generate one on the fly
    return this.generateAndSaveDraft('professional', useCase);
  }

  /**
   * Get the best draft (by performance) – kept for compatibility but not used in random mode.
   */
  async getBestDraft(useCase: string = 'initial', tone: string = 'professional', campaignId?: string) {
    if (campaignId) {
      const campaignDraft = await prisma.draft.findFirst({
        where: {
          campaignId,
          useCase,
          tone,
          isActive: true,
        },
        orderBy: [
          { replyCount: 'desc' },
          { sentCount: 'desc' },
          { createdAt: 'desc' },
        ],
      });
      if (campaignDraft) return campaignDraft;
    }
		
    const globalDraft = await prisma.draft.findFirst({
      where: {
        campaignId: null,
        useCase,
        tone,
        isActive: true,
      },
      orderBy: [
        { replyCount: 'desc' },
        { sentCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (globalDraft) return globalDraft;

    return this.generateAndSaveDraft(tone, useCase);
  }
	
  /**
   * Get all active drafts for a campaign.
   */
  async getAllDraftsForCampaign(campaignId: string) {
    return prisma.draft.findMany({
      where: {
        campaignId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }


  /**
   * List drafts, optionally filtered by campaign.
   */
  async listDrafts(campaignId?: string, activeOnly = true) {
    return prisma.draft.findMany({
      where: {
        ...(campaignId ? { campaignId } : {}),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}