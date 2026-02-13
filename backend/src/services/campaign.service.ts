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

		// Get all active drafts for this campaign
		const drafts = await draftService.getAllDraftsForCampaign(campaignId);
		if (!drafts.length) {
			logger.error({ campaignId }, 'No drafts available for campaign');
			await this.failCampaign(campaignId, 'No drafts available');
			return;
		}

		// Get campaign context for possible reference company
		// For now, we don't have a separate reference company field; we'll pass null.
		// In future, could extract from campaign.context.

		for (const lead of campaign.leads) {
			try {
				await prisma.lead.update({
					where: { id: lead.id },
					data: { outreachStatus: 'PROCESSING' as OutreachStatus },
				});

				// Randomly select a draft
				const draft = drafts[Math.floor(Math.random() * drafts.length)];

				// Personalise email (no reference company for now)
				const { subject, body } = personalisationService.personalise(
					lead as any,
					draft.subject,
					draft.body,
					null // referenceCompany – can be passed from campaign.context in future
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

				logger.info({ leadId: lead.id, campaignId, draftId: draft.id, success: result.success }, 'Lead processed');
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