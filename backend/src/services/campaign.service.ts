import { OutreachStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
  /**
   * Create a new campaign with modern settings (autoReply, sendHourUTC).
   * Generates 5 initial drafts and 3 follow‑up drafts for step 1.
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
          sendHourUTC: sendHourUTC ?? 9,
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
      const followUpDrafts = await draftService.generateFollowUpDrafts(
        userId,
        campaign.id,
        context,
        reference,
        senderName,
        1, // stepNumber
        3  // count
      );

      // Create step 1 with default delay 3 days (no direct draft link)
      await prisma.followUpStep.create({
        data: {
          campaignId: campaign.id,
          stepNumber: 1,
          delayDays: 3,
        },
      });

      logger.info({ campaignId: campaign.id, draftCount: followUpDrafts?.length }, 'Campaign created with 5 initial and 3 follow‑up drafts for step 1');

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
   * Update active hours.
   */
  async updateActiveHours(
    userId: string,
    campaignId: string,
    activeStartHour?: number | null,
    activeEndHour?: number | null,
    timezone?: string | null
  ) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaign.update({
      where: { id: campaignId },
      data: { activeStartHour, activeEndHour, timezone },
    });
  }

  /**
   * Get all follow‑up steps for a campaign (with draft counts).
   */
  async getFollowUpSteps(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    const steps = await prisma.followUpStep.findMany({
      where: { campaignId },
      orderBy: { stepNumber: 'asc' },
    });

    // Add draft count to each step
    const stepsWithCounts = await Promise.all(
      steps.map(async (step) => {
        const draftCount = await prisma.draft.count({
          where: { userId, campaignId, stepNumber: step.stepNumber, isActive: true },
        });
        return { ...step, draftCount };
      })
    );

    return stepsWithCounts;
  }

  /**
   * Replace all follow‑up steps for a campaign (bulk update).
   */
  async setFollowUpSteps(
    userId: string,
    campaignId: string,
    steps: { stepNumber: number; delayDays: number }[]
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
        where: { userId, campaignId, isActive: true, useCase: 'initial' },
      });

      if (drafts.length === 0) {
        logger.info({ campaignId }, 'No initial drafts found, generating 5 new drafts');
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
          drafts = await prisma.draft.findMany({ where: { userId, campaignId, isActive: true, useCase: 'initial' } });
        }
      }

      if (drafts.length === 0) {
        logger.error({ campaignId }, 'Failed to generate initial drafts');
        return;
      }

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

          logger.info({ leadId: lead.id, selectedDraftId: draft.id }, 'Random draft selected for lead');

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

          // Queue the email
          await emailService.queueEmail(
            userId,
            lead.id,
            campaignId,
            draft.id,
            subject,
            body
          );

          await prisma.lead.update({
            where: { id: lead.id },
            data: { outreachStatus: 'QUEUED' as OutreachStatus },
          });

          logger.info({ leadId: lead.id }, 'Email queued');
        } catch (error: any) {
          logger.error({ error, leadId: lead.id }, 'Error processing lead');
          await prisma.lead.update({
            where: { id: lead.id },
            data: { outreachStatus: 'FAILED' as OutreachStatus },
          });
        }
      }

      if (!specificLeadIds) {
        const remaining = await prisma.lead.count({
          where: { userId, campaignId, outreachStatus: { in: ['PENDING', 'PROCESSING', 'QUEUED'] } },
        });
        if (remaining === 0) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'COMPLETED', completedAt: new Date() },
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
   * Get detailed campaign information, including follow‑up steps with draft counts.
   */
  async getCampaignDetails(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
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
        },
      },
    });

    if (!campaign) return null;

    // Compute draft counts for each step
    const stepsWithCounts = await Promise.all(
      campaign.followUpSteps.map(async (step) => {
        const draftCount = await prisma.draft.count({
          where: { userId, campaignId, stepNumber: step.stepNumber, isActive: true },
        });
        return { ...step, draftCount };
      })
    );

    // Compute queued count
    const queuedCount = await prisma.pendingEmail.count({
      where: { userId, campaignId, status: 'PENDING' },
    });

    return {
      ...campaign,
      followUpSteps: stepsWithCounts,
      queuedCount,
    };
  }
}