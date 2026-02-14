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
        // Process leads after drafts are guaranteed to exist
        await this.processCampaign(campaign.id);
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

    // Process the newly added leads (non‑blocking but we await to ensure drafts exist)
    await this.processCampaign(campaignId, newLeadIds);

    return { added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length };
  }

  /**
   * Process leads in a campaign (all pending leads or a specific subset).
   */
  private async processCampaign(campaignId: string, specificLeadIds?: string[]) {
    // Fetch all active drafts for this campaign
    let drafts = await prisma.draft.findMany({
      where: {
        campaignId,
        isActive: true,
        useCase: 'initial',
      },
    });

    // If no drafts exist, generate a batch of 5 on the fly
    if (drafts.length === 0) {
      logger.info({ campaignId }, 'No drafts found, generating 5 new drafts');
      await draftService.generateMultipleDrafts(
        5,
        'professional',
        'initial',
        campaignId,
        (await prisma.campaign.findUnique({ where: { id: campaignId } }))?.context || undefined,
        (await prisma.campaign.findUnique({ where: { id: campaignId } }))?.reference || undefined
      );
      drafts = await prisma.draft.findMany({
        where: {
          campaignId,
          isActive: true,
          useCase: 'initial',
        },
      });
    }

    if (drafts.length === 0) {
      logger.error({ campaignId }, 'Failed to generate drafts');
      return;
    }

    logger.info({ campaignId, draftCount: drafts.length }, 'Drafts available for campaign');

    // Determine which leads to process
    const whereClause: any = { campaignId };
    if (specificLeadIds) {
      whereClause.id = { in: specificLeadIds };
    } else {
      whereClause.outreachStatus = { in: ['PENDING', 'PROCESSING'] };
    }

    const leads = await prisma.lead.findMany({ where: whereClause });

    if (leads.length === 0) return;

    for (const lead of leads) {
      try {
        // Pick a random draft for this lead
        const randomIndex = Math.floor(Math.random() * drafts.length);
        const draft = drafts[randomIndex];

        logger.debug({ leadId: lead.id, draftId: draft.id }, 'Selected draft for lead');

        await prisma.lead.update({
          where: { id: lead.id },
          data: { outreachStatus: 'PROCESSING' as OutreachStatus },
        });

        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

        const { subject, body } = personalisationService.personalise(
          lead as any,
          draft.subject,
          draft.body,
          campaign?.reference
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

    // Check if all leads are processed (only if not a subset)
    if (!specificLeadIds) {
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