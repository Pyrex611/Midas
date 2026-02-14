import { OutreachStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
  /**
   * Create a new campaign with user‑provided context/reference, generate 5 drafts, and optionally start it.
   */
  async createCampaign(
    name: string,
    description?: string,
    context?: string,
    reference?: string,
    leadIds?: string[]
  ) {
    if (!prisma.campaign) {
      throw new Error('Database schema not ready. Please run: npx prisma migrate dev');
    }

    try {
      const campaign = await prisma.campaign.create({
        data: {
          name,
          description,
          context,
          reference,
          status: leadIds?.length ? 'ACTIVE' : 'DRAFT',
          startedAt: leadIds?.length ? new Date() : null,
          ...(leadIds?.length && {
            leads: { connect: leadIds.map(id => ({ id })) },
          }),
        },
      });

      // Generate 5 varied drafts for this campaign
      await draftService.generateMultipleDrafts(
        5,
        'professional',
        'initial',
        campaign.id,
        context,
        reference
      );

      logger.info({ campaignId: campaign.id }, 'Campaign created with 5 drafts');

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
   * Add leads to an existing campaign, skipping duplicates.
   */
  async addLeadsToCampaign(campaignId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
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
      where: { id: { in: newLeadIds } },
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

    // Start processing these leads (non‑blocking)
    this.processCampaign(campaignId).catch(err => {
      logger.error({ err, campaignId }, 'Campaign processing failed');
    });

    return { added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length };
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

    for (const lead of campaign.leads) {
      try {
				const draft = await this.getRandomDraft(campaignId, 'initial');
				if (!draft) {
					logger.error({ campaignId, leadId: lead.id }, 'No draft available for lead');
					await prisma.lead.update({
						where: { id: lead.id },
						data: { outreachStatus: 'PROCESSING' as OutreachStatus },
					});
					continue;
				}

				await prisma.lead.update({
					where: { id: lead.id },
					data: { outreachStatus: 'PROCESSING' as OutreachStatus },
				});

        const { subject, body } = personalisationService.personalise(
          lead as any,
          draft.subject,
          draft.body,
          campaign.reference
        );

        const result = await emailService.sendEmail(
          lead.email,
          subject,
          body.replace(/\n/g, '<br>'),
          body
        );

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

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            outreachStatus: result.success ? ('SENT' as OutreachStatus) : ('FAILED' as OutreachStatus),
            status: result.success ? 'CONTACTED' : 'NEW',
          },
        });

        await prisma.draft.update({
          where: { id: draft.id },
          data: { sentCount: { increment: 1 } },
        });

        logger.info({ leadId: lead.id, campaignId, success: result.success }, 'Lead processed');
      } catch (error) {
        logger.error({ error, leadId: lead.id, campaignId }, 'Failed to process lead');
        await prisma.lead.update({
          where: { id: lead.id },
          data: { outreachStatus: 'FAILED' as OutreachStatus },
        });
      }
    }

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

  /**
   * Get a random active draft for a campaign (for variety).
   */
  async getRandomDraft(campaignId: string, useCase: string = 'initial') {
    const drafts = await prisma.draft.findMany({
      where: {
        campaignId,
        useCase,
        isActive: true,
      },
    });

    if (drafts.length > 0) {
      return drafts[Math.floor(Math.random() * drafts.length)];
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
      return globalDrafts[Math.floor(Math.random() * globalDrafts.length)];
    }

    // If no draft exists, generate one on the fly
    return this.generateDraftForCampaign(campaignId, useCase);
  }

  private async generateDraftForCampaign(campaignId: string, useCase: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new Error('Campaign not found');
    return draftService.generateAndSaveDraft(
      'professional',
      useCase,
      campaignId,
      campaign.context || undefined,
      campaign.reference || undefined
    );
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
      data: { outreachStatus: 'FAILED' as OutreachStatus },
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