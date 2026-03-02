import { OutreachStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
  /**
   * Create a new campaign with user‑provided context/reference, generate 5 drafts,
   * and mark leads as PENDING.
   */
  async createCampaign(
    name: string,
    description?: string,
    context?: string,
    reference?: string,
    senderName?: string,
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
          senderName,
          status: leadIds?.length ? 'ACTIVE' : 'DRAFT',
          startedAt: leadIds?.length ? new Date() : null,
          ...(leadIds?.length && {
            leads: { connect: leadIds.map(id => ({ id })) },
          }),
        },
      });

      // If leads were added, set their outreachStatus to PENDING
      if (leadIds?.length) {
        await prisma.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { outreachStatus: 'PENDING' as OutreachStatus },
        });
      }

      // Generate 5 varied drafts
      await draftService.generateMultipleDrafts(
        5,
        'professional',
        'initial',
        campaign.id,
        context,
        reference,
        undefined,
        senderName
      );

      logger.info({ campaignId: campaign.id }, 'Campaign created with 5 drafts');

      // Process leads in the background
      if (leadIds?.length) {
        this.processCampaign(campaign.id).catch(err => {
          logger.error({ err, campaignId: campaign.id }, 'Background campaign processing failed');
        });
      }

      return campaign;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create campaign');
      throw new Error('Could not create campaign');
    }
  }

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

    // Process in background
    this.processCampaign(campaignId, newLeadIds).catch(err => {
      logger.error({ err, campaignId }, 'Background lead processing failed');
    });

    return { added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length };
  }

  /**
   * Process leads in a campaign (all pending leads or a specific subset).
   */
  private async processCampaign(campaignId: string, specificLeadIds?: string[]) {
    try {
      // Fetch all active drafts for this campaign
      let drafts = await prisma.draft.findMany({
        where: {
          campaignId,
          isActive: true,
          useCase: 'initial',
        },
      });

      if (drafts.length === 0) {
        logger.info({ campaignId }, 'No drafts found, generating 5 new drafts');
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        await draftService.generateMultipleDrafts(
          5,
          'professional',
          'initial',
          campaignId,
          campaign?.context || undefined,
          campaign?.reference || undefined,
          undefined,
          campaign?.senderName || undefined
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
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

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
            campaign?.senderName
          );

          const finalOutreachStatus = result.success ? 'SENT' : 'FAILED';
          const finalLeadStatus = result.success ? 'CONTACTED' : 'NEW';

          await prisma.outboundEmail.create({
            data: {
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
      logger.error({ error, campaignId }, 'Fatal error in processCampaign');
    }
  }

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