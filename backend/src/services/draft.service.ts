import prisma from '../lib/prisma';
import { aiService } from './ai.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class DraftService {
  /**
   * Generate a single draft. Returns null on failure.
   */
  async generateAndSaveDraft(
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignId?: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string,
    senderName?: string
  ) {
    try {
      const { subject, body } = await aiService.generateDraft(
        tone,
        useCase,
        campaignContext,
        reference,
        companyContext,
        undefined,
        undefined
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
      logger.error({ error, tone, useCase, campaignId }, 'Failed to generate draft');
      return null; // Return null instead of throwing
    }
  }

  /**
   * Generate multiple drafts, skipping any that fail.
   */
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
    const delayMs = env.AI_REQUEST_DELAY_MS;

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
      if (draft) {
        drafts.push(draft);
      } else {
        logger.warn({ campaignId, index: i }, 'Skipping failed draft');
      }

      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logger.info({ campaignId, generated: drafts.length, requested: count }, 'Generated multiple drafts');
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

  async updateDraft(id: string, data: { subject?: string; body?: string; tone?: string }) {
    return prisma.draft.update({
      where: { id },
      data,
    });
  }

  async deleteDraft(id: string) {
    return prisma.draft.delete({ where: { id } });
  }

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

  async getReplyDraft(leadId: string, campaignId: string) {
    return prisma.draft.findFirst({
      where: {
        leadId,
        campaignId,
        isReplyDraft: true,
        isActive: true,
      },
    });
  }

  async createReplyDraft(leadId: string, campaignId: string, subject: string, body: string, tone: string = 'professional') {
    await prisma.draft.deleteMany({
      where: { leadId, campaignId, isReplyDraft: true },
    });
    return prisma.draft.create({
      data: {
        subject,
        body,
        tone,
        useCase: 'reply',
        version: 1,
        isActive: true,
        campaignId,
        leadId,
        isReplyDraft: true,
      },
    });
  }

  async deleteReplyDraft(leadId: string, campaignId: string) {
    return prisma.draft.deleteMany({
      where: { leadId, campaignId, isReplyDraft: true },
    });
  }
}