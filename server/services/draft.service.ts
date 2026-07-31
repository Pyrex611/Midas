import prisma from '../lib/prisma';
import { aiService } from './ai.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class DraftService {
  /**
   * Generate a single draft. Returns null on failure.
   */
  async generateAndSaveDraft(
    userId: string,
    tone: string = 'professional',
    useCase: 'initial' | 'followup' | 'reply' = 'initial',
    campaignId?: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string,
    senderName?: string,
    stepNumber?: number,
    objective?: string | null,
    targetTool?: string | null,
    microObjective?: string | null,
    lastEmailContent?: string | null
  ) {
    try {
      const { subject, body } = await aiService.generateDraft(
        tone, useCase, campaignContext, reference, companyContext, 
        undefined, undefined, stepNumber, objective, microObjective, targetTool, lastEmailContent
      );

      return await prisma.draft.create({
        data: {
          userId, subject, body, tone, useCase,
          isActive: true, campaignId, stepNumber
        },
      });
    } catch (error) {
      logger.error({ error }, 'Individual Draft Generation Failed');
      return null;
    }
  }

  /**
   * Generate multiple drafts for a given use case.
   */
  async generateMultipleDrafts(
    userId: string,
    count: number,
    tone: string = 'professional',
    useCase: 'initial' | 'followup' = 'initial',
    campaignId?: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string,
    senderName?: string,
    stepNumber?: number,
    objective?: string | null,
    targetTool?: string | null,
    microObjective?: string | null
  ) {
    const drafts = [];
    for (let i = 0; i < count; i++) {
      const draft = await this.generateAndSaveDraft(
        userId, tone, useCase, campaignId, campaignContext, reference, 
        companyContext, senderName, stepNumber, objective, targetTool, microObjective
      );
      if (draft) drafts.push(draft);
      // Brief delay to ensure variations in clock-based random seeds if applicable
      await new Promise(r => setTimeout(r, 200));
    }
    return drafts;
  }
	
  /**
   * Generate follow‑up drafts for a specific step.
   * @param count Number of drafts to generate (default 3 for step 1, 1 for others)
   */
  async generateFollowUpDrafts(
    userId: string,
    campaignId: string,
    campaignContext?: string,
    reference?: string,
    senderName?: string,
    stepNumber: number = 1,
    count: number = 3
  ) {
    logger.info({ campaignId, stepNumber, count }, 'Generating follow‑up drafts');
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

  async getBestDraft(
    userId: string,
    useCase: string = 'initial',
    tone: string = 'professional',
    campaignId?: string
  ) {
    if (campaignId) {
      const campaignDraft = await prisma.draft.findFirst({
        where: {
          userId,
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
        userId,
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

    return null;
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
    userId: string,
    subject: string,
    body: string,
    campaignId?: string,
    tone: string = 'custom'
  ) {
    return prisma.draft.create({
      data: {
        userId,
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

  async createReplyDraft(
    userId: string,
    leadId: string,
    campaignId: string,
    subject: string,
    body: string,
    tone: string = 'professional'
  ) {
    // Delete any existing reply draft for this lead
    await prisma.draft.deleteMany({
      where: { leadId, campaignId, isReplyDraft: true },
    });
    return prisma.draft.create({
      data: {
        userId,
        leadId,
        campaignId,
        subject,
        body,
        tone,
        useCase: 'reply',
        version: 1,
        isActive: true,
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

export const draftService = new DraftService();