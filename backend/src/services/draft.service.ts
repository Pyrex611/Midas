import prisma from '../lib/prisma';
import { aiService } from './ai.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class DraftService {
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

  async generateMultipleDrafts(
		count: number,
		tone: string = 'professional',
		useCase: string = 'initial',
		campaignId?: string,
		campaignContext?: string,
		reference?: string,
		companyContext?: string,
		senderName?: string
	) {
		const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
		const drafts = [];
		const delayMs = parseInt(env.AI_REQUEST_DELAY_MS || '500'); // configurable

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
				companyContext,
				senderName
			);
			drafts.push(draft);

			// Wait between requests (except after the last one)
			if (i < count - 1) {
				await new Promise(resolve => setTimeout(resolve, delayMs));
			}
		}

		logger.info({ campaignId, count }, 'Generated multiple drafts');
		return drafts;
	}

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

  async listDrafts(campaignId?: string, activeOnly = true) {
    return prisma.draft.findMany({
      where: {
        ...(campaignId ? { campaignId } : {}),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ NEW: Update draft
  async updateDraft(id: string, data: { subject?: string; body?: string; tone?: string }) {
    return prisma.draft.update({
      where: { id },
      data,
    });
  }

  // ✅ NEW: Delete draft (soft delete by setting isActive false, or hard delete)
  async deleteDraft(id: string) {
    // Hard delete (can also soft delete by setting isActive: false)
    return prisma.draft.delete({ where: { id } });
  }

  // ✅ NEW: Create a custom draft (user-provided subject/body)
  async createCustomDraft(
    subject: string,
    body: string,
    campaignId?: string,
    tone: string = 'custom'
  ) {
    return prisma.draft.create({
      data: {
        subject,
        body,
        tone,
        useCase: 'initial',
        version: 1,
        isActive: true,
        campaignId,
      },
    });
  }
}