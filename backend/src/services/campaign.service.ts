import { OutreachStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
  /**
   * Create a new campaign with modern follow‑up settings (autoReply, sendHourUTC).
   * Legacy followUpEnabled/followUpDelay are no longer used.
   */
  async createCampaign(
    userId: string,
    name: string,
    description?: string,
    context?: string,
    reference?: string,
    senderName?: string,
    leadIds?: string[],
    autoReplyEnabled?: boolean,
    sendHourUTC?: number
  ) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error(`Invalid userId format: ${userId}. Expected a UUID.`);
    }

    logger.debug({ userId }, 'Creating campaign for user');

    try {
      const campaign = await prisma.campaign.create({
        data: {
          userId,
          name,
          description,
          context,
          reference,
          senderName,
          status: leadIds?.length ? 'ACTIVE' : 'DRAFT',
          startedAt: leadIds?.length ? new Date() : null,
          autoReplyEnabled: autoReplyEnabled ?? false,
          sendHourUTC: sendHourUTC ?? 9, // default 9 AM UTC
          ...(leadIds?.length && {
            leads: { connect: leadIds.map(id => ({ id })) },
          }),
        },
      });

      // Set outreach status to PENDING for initial leads
      if (leadIds?.length) {
        await prisma.lead.updateMany({
          where: { id: { in: leadIds }, userId },
          data: { outreachStatus: 'PENDING' as OutreachStatus },
        });
      }

      // Generate 5 varied initial drafts
      await draftService.generateMultipleDrafts(
        userId,
        5,
        'professional',
        'initial',
        campaign.id,
        context,
        reference,
        undefined,
        senderName
      );

      // Generate 3 follow‑up drafts for step 1
      await draftService.generateFollowUpDrafts(
        userId,
        campaign.id,
        context,
        reference,
        senderName,
        1
      );

      logger.info({ campaignId: campaign.id }, 'Campaign created with 5 initial and 3 follow‑up drafts');

      // Process leads in the background
      if (leadIds?.length) {
        this.processCampaign(userId, campaign.id).catch(err => {
          logger.error({ err, campaignId: campaign.id }, 'Background campaign processing failed');
        });
      }

      return campaign;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create campaign');
      throw new Error('Could not create campaign');
    }
  }

  /**
   * Add leads to an existing campaign, skipping duplicates.
   */
  async addLeadsToCampaign(userId: string, campaignId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: { leads: { select: { id: true } } },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const existingLeadIds = new Set(campaign.leads.map(l => l.id));
    const newLeadIds = leadIds.filter(id => !existingLeadIds.has(id));

    if (newLeadIds.length === 0) {
      return { added: 0, skipped: leadIds.length };
    }

    await prisma.lead.updateMany({
      where: { id: { in: newLeadIds }, userId },
      data: {
        campaignId,
        outreachStatus: 'PENDING' as OutreachStatus,
      },
    });

    if (campaign.status === 'DRAFT') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      });
    }

    // Process in background
    this.processCampaign(userId, campaignId, newLeadIds).catch(err => {
      logger.error({ err, userId, campaignId }, 'Background lead processing failed');
    });

    return { added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length };
  }

  /**
   * Update follow‑up settings (legacy – kept for backward compatibility).
   */
  async updateFollowUpSettings(
    userId: string,
    campaignId: string,
    followUpEnabled: boolean,
    followUpDelay?: number
  ) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaign.update({
      where: { id: campaignId },
      data: {
        followUpEnabled,
        followUpDelay: followUpDelay ?? campaign.followUpDelay,
      },
    });
  }

  /**
   * Update auto‑reply setting.
   */
  async updateAutoReplySettings(userId: string, campaignId: string, autoReplyEnabled: boolean) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaign.update({
      where: { id: campaignId },
      data: { autoReplyEnabled },
    });
  }

  /**
   * Update send hour (UTC).
   */
  async updateSendHour(userId: string, campaignId: string, sendHourUTC: number) {
    if (sendHourUTC < 0 || sendHourUTC > 23) throw new Error('sendHourUTC must be 0-23');
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaign.update({
      where: { id: campaignId },
      data: { sendHourUTC },
    });
  }

  /**
   * Get all follow‑up steps for a campaign.
   */
  async getFollowUpSteps(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.followUpStep.findMany({
      where: { campaignId },
      orderBy: { stepNumber: 'asc' },
      include: { draft: true },
    });
  }

  /**
   * Replace all follow‑up steps for a campaign (bulk update).
   */
  async setFollowUpSteps(
    userId: string,
    campaignId: string,
    steps: { stepNumber: number; delayDays: number; draftId?: string | null }[]
  ) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    // Validate step numbers are unique
    const stepNumbers = steps.map(s => s.stepNumber);
    if (new Set(stepNumbers).size !== steps.length) {
      throw new Error('Duplicate step numbers not allowed');
    }

    // Use transaction to replace all steps
    return prisma.$transaction(async (tx) => {
      await tx.followUpStep.deleteMany({ where: { campaignId } });
      const created = await Promise.all(
        steps.map(step =>
          tx.followUpStep.create({
            data: {
              campaignId,
              stepNumber: step.stepNumber,
              delayDays: step.delayDays,
              draftId: step.draftId,
            },
          })
        )
      );
      return created;
    });
  }

  /**
   * Delete a specific follow‑up step.
   */
  async deleteFollowUpStep(userId: string, stepId: string) {
    const step = await prisma.followUpStep.findUnique({
      where: { id: stepId },
      include: { campaign: true },
    });
    if (!step) throw new Error('Step not found');
    if (step.campaign.userId !== userId) throw new Error('Unauthorized');
    await prisma.followUpStep.delete({ where: { id: stepId } });
  }

  /**
   * Process leads in a campaign (initial outreach).
   */
  private async processCampaign(userId: string, campaignId: string, specificLeadIds?: string[]) {
    try {
      let drafts = await prisma.draft.findMany({
        where: {
          userId,
          campaignId,
          isActive: true,
          useCase: 'initial',
        },
      });

      if (drafts.length === 0) {
        logger.info({ campaignId }, 'No drafts found, generating 5 new drafts');
        const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
        if (campaign) {
          await draftService.generateMultipleDrafts(
            userId,
            5,
            'professional',
            'initial',
            campaignId,
            campaign.context || undefined,
            campaign.reference || undefined,
            undefined,
            campaign.senderName || undefined
          );
          drafts = await prisma.draft.findMany({
            where: {
              userId,
              campaignId,
              isActive: true,
              useCase: 'initial',
            },
          });
        }
      }

      if (drafts.length === 0) {
        logger.error({ campaignId }, 'Failed to generate drafts');
        return;
      }

      logger.info({ campaignId, draftCount: drafts.length }, 'Drafts available for campaign');

      const whereClause: any = { userId, campaignId };
      if (specificLeadIds) {
        whereClause.id = { in: specificLeadIds };
      } else {
        whereClause.outreachStatus = { in: ['PENDING', 'PROCESSING'] };
      }

      const leads = await prisma.lead.findMany({ where: whereClause });
      const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });

      if (leads.length === 0) return;

      for (const lead of leads) {
        try {
          const randomIndex = Math.floor(Math.random() * drafts.length);
          const draft = drafts[randomIndex];

          logger.info({
            leadId: lead.id,
            selectedDraftId: draft.id,
            draftIndex: randomIndex,
            totalDrafts: drafts.length,
          }, 'Random draft selected for lead');

          await prisma.lead.update({
            where: { id: lead.id },
            data: { outreachStatus: 'PROCESSING' as OutreachStatus },
          });

          const { subject, body } = personalisationService.personalise(
            lead as any,
            draft.subject,
            draft.body,
            campaign?.reference,
            campaign?.senderName
          );

          const result = await emailService.sendEmail(
            lead.email,
            subject,
            body.replace(/\n/g, '<br>'),
            body,
            campaign?.senderName,
            undefined,
            userId
          );

          const finalOutreachStatus = result.success ? 'SENT' : 'FAILED';
          const finalLeadStatus = result.success ? 'CONTACTED' : 'NEW';

          await prisma.outboundEmail.create({
            data: {
              userId,
              leadId: lead.id,
              campaignId,
              draftId: draft.id,
              subject,
              body,
              status: finalOutreachStatus,
              error: result.error,
              messageId: result.messageId,
            },
          });

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              outreachStatus: finalOutreachStatus as OutreachStatus,
              status: finalLeadStatus,
            },
          });

          if (result.success) {
            await prisma.draft.update({
              where: { id: draft.id },
              data: { sentCount: { increment: 1 } },
            });
          }

          logger.info({
            leadId: lead.id,
            campaignId,
            success: result.success,
            error: result.error,
          }, 'Lead processed');
        } catch (error: any) {
          logger.error({ error, leadId: lead.id, campaignId }, 'Unexpected error processing lead');
          await prisma.lead.update({
            where: { id: lead.id },
            data: { outreachStatus: 'FAILED' as OutreachStatus },
          });
        }
      }

      if (!specificLeadIds) {
        const remaining = await prisma.lead.count({
          where: {
            userId,
            campaignId,
            outreachStatus: { in: ['PENDING', 'PROCESSING'] },
          },
        });

        if (remaining === 0) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      logger.error({ error, userId, campaignId }, 'Fatal error in processCampaign');
    }
  }

  /**
   * Get all campaigns for a user.
   */
  async getCampaigns(userId: string) {
    return prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            leads: true,
            emails: true,
            drafts: true,
          },
        },
      },
    });
  }

  /**
   * Get detailed campaign information.
   */
  async getCampaignDetails(userId: string, campaignId: string) {
    return prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        leads: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            position: true,
            outreachStatus: true,
            status: true,
          },
        },
        drafts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        emails: {
          orderBy: { sentAt: 'desc' },
          take: 100,
        },
        followUpSteps: {
          orderBy: { stepNumber: 'asc' },
          include: { draft: true },
        },
      },
    });
  }
}