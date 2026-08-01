import prisma from '../lib/prisma';
import { aiService } from './ai.service';
import { logger } from '../config/logger';

export class DraftService {
  async generateAndSaveDraft(
    userId: string,
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignId?: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string,
    senderName?: string,
    stepNumber?: number
  ) {
    try {
      const { subject, body } = await aiService.generateDraft(
        tone,
        useCase as any,
        campaignContext,
        reference,
        companyContext,
        undefined,
        undefined,
        stepNumber
      );

      const draft = await prisma.draft.create({
        data: {
          userId,
          subject,
          body,
          tone,
          useCase,
          version: 1,
          isActive: true,
          campaignId,
          stepNumber,
        },
      });

      logger.info({ draftId: draft.id, campaignId, stepNumber }, 'Draft generated and saved');
      return draft;
    } catch (error) {
      logger.error({ error, tone, useCase, campaignId, stepNumber }, 'Failed to generate draft');
      return null;
    }
  }

  async generateMultipleDrafts(
    userId: string,
    count: number,
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignId?: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string,
    senderName?: string,
    stepNumber?: number
  ) {
    const tones = ['professional', 'friendly', 'urgent', 'data-driven', 'storytelling'];
    const drafts = [];

    for (let i = 0; i < count; i++) {
      const variedTone = tones[i % tones.length];
      const draft = await this.generateAndSaveDraft(
        userId,
        variedTone,
        useCase,
        campaignId,
        campaignContext,
        reference,
        companyContext,
        senderName,
        stepNumber
      );
      if (draft) drafts.push(draft);
    }

    return drafts;
  }

  async generateFollowUpDrafts(
    userId: string,
    campaignId: string,
    campaignContext?: string,
    reference?: string,
    senderName?: string,
    stepNumber: number = 1,
    count: number = 3
  ) {
    return this.generateMultipleDrafts(
      userId,
      count,
      'professional',
      'followup',
      campaignId,
      campaignContext,
      reference,
      undefined,
      senderName,
      stepNumber
    );
  }

  async listDrafts(campaignId?: string) {
    return prisma.draft.findMany({
      where: {
        ...(campaignId ? { campaignId } : {}),
        isActive: true,
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
}

export const draftService = new DraftService();