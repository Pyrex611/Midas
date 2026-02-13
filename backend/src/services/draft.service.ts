import prisma from '../lib/prisma';
import { aiService } from './ai.service';
import { logger } from '../config/logger';

export class DraftService {
  /**
   * Generate a new draft, optionally associated with a campaign.
   */
  async generateAndSaveDraft(
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignId?: string,
    campaignContext?: string,
    companyContext?: string
  ) {
    try {
      const { subject, body } = await aiService.generateDraft(
        tone,
        useCase,
        campaignContext,
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
          campaignId, // 👈 Associate with campaign if provided
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
   * Get the best active draft for a given campaign and use case.
   * If no campaign‑specific draft exists, fall back to global best.
   */
  async getBestDraft(
    useCase: string = 'initial',
    tone: string = 'professional',
    campaignId?: string
  ) {
    // Try campaign‑specific draft first
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

    // Fallback to global draft
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

    // No draft exists – generate a global one on‑the‑fly
    return this.generateAndSaveDraft(tone, useCase);
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