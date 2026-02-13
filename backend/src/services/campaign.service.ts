import { OutreachStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
  /**
   * Create a new campaign with user‑provided context, generate a draft, and optionally start it.
   */
  async createCampaign(
    name: string,
    description?: string,
    context?: string,
    leadIds?: string[]
  ) {
    // Defensive: ensure models exist
    if (!prisma.campaign) {
      throw new Error('Database schema not ready. Please run: npx prisma migrate dev');
    }

    try {
      const campaign = await prisma.campaign.create({
        data: {
          name,
          description,
          context,
          status: leadIds?.length ? 'ACTIVE' : 'DRAFT',
          startedAt: leadIds?.length ? new Date() : null,
          ...(leadIds?.length && {
            leads: { connect: leadIds.map(id => ({ id })) },
          }),
        },
      });

      // Generate an initial draft specifically for this campaign
      await draftService.generateAndSaveDraft(
        'professional',
        'initial',
        campaign.id,
        context || 'General outreach'
      );

      logger.info({ campaignId: campaign.id }, 'Campaign created');

      // If leads were provided, start processing immediately
      if (leadIds?.length) {
        this.processCampaign(campaign.id).catch(err => {
          logger.error({ err, campaignId: campaign.id }, 'Campaign processing failed');
        });
      }

      return campaign;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create campaign');
      throw new Error('Could not create campaign');
    }
  }

  /**
   * Add leads to an existing campaign.
   */
  async addLeadsToCampaign(campaignId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Connect leads to campaign and set outreach status
    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: {
        campaignId,
        outreachStatus: 'PENDING',
      },
    });

    // If campaign is not active, activate it
    if (campaign.status === 'DRAFT') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      });
    }

    // Start processing these leads (non‑blocking)
    this.processCampaign(campaignId).catch(err => {
      logger.error({ err, campaignId }, 'Campaign processing failed');
    });

    return { success: true };
  }

  /**
   * Process all pending leads in a campaign.
   */
  private async processCampaign(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: {
          where: {
            outreachStatus: { in: ['PENDING', 'PROCESSING'] },
          },
        },
      },
    });

    if (!campaign) {
      logger.error({ campaignId }, 'Campaign not found');
      return;
    }

    // Get the best draft for this campaign
    const draft = await draftService.getBestDraft('initial', 'professional', campaignId);
    if (!draft) {
      logger.error({ campaignId }, 'No draft available');
      await this.failCampaign(campaignId, 'No draft available');
      return;
    }

    for (const lead of campaign.leads) {
      try {
        // Mark as PROCESSING
        await prisma.lead.update({
          where: { id: lead.id },
          data: { outreachStatus: 'PROCESSING' },
        });

        // Personalise email
        const { subject, body } = personalisationService.personalise(
          lead as any,
          draft.subject,
          draft.body
        );

        // Send email (preview mode in dev)
        const result = await emailService.sendEmail(
          lead.email,
          subject,
          body.replace(/\n/g, '<br>'),
          body
        );

        // Log outbound email
        await prisma.outboundEmail.create({
          data: {
            leadId: lead.id,
            campaignId,
            draftId: draft.id,
            subject,
            body,
            status: result.success ? 'SENT' : 'FAILED',
            error: result.error,
          },
        });

        // Update lead status
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            outreachStatus: result.success ? 'SENT' : 'FAILED',
            status: result.success ? 'CONTACTED' : 'NEW',
          },
        });

        // Increment draft sent count
        await prisma.draft.update({
          where: { id: draft.id },
          data: { sentCount: { increment: 1 } },
        });

        logger.info({ leadId: lead.id, campaignId, success: result.success }, 'Lead processed');
      } catch (error) {
        logger.error({ error, leadId: lead.id, campaignId }, 'Failed to process lead');
        await prisma.lead.update({
          where: { id: lead.id },
          data: { outreachStatus: 'FAILED' },
        });
      }
    }

    // Check if all leads are processed
    const remaining = await prisma.lead.count({
      where: {
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

  private async failCampaign(campaignId: string, reason: string) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });
    await prisma.lead.updateMany({
      where: { campaignId },
      data: { outreachStatus: 'FAILED' },
    });
  }

  /**
   * Get all campaigns (summary list).
   */
  async getCampaigns() {
    return prisma.campaign.findMany({
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
  async getCampaignDetails(campaignId: string) {
    return prisma.campaign.findUnique({
      where: { id: campaignId },
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
      },
    });
  }
}