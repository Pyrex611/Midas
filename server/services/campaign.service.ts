import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
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
            leads: { connect: leadIds.map((id: string) => ({ id })) },
          }),
        },
      });

      if (leadIds?.length) {
        await prisma.lead.updateMany({
          where: { id: { in: leadIds }, userId },
          data: { outreachStatus: 'PENDING', campaignId: campaign.id },
        });
      }

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

      await draftService.generateFollowUpDrafts(
        userId,
        campaign.id,
        context,
        reference,
        senderName,
        1,
        3
      );

      await prisma.followUpStep.create({
        data: {
          campaignId: campaign.id,
          stepNumber: 1,
          delayDays: 3,
        },
      });

      logger.info({ campaignId: campaign.id }, 'Campaign created successfully');
      return campaign;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create campaign');
      throw new Error('Could not create campaign');
    }
  }

  async addLeadsToCampaign(userId: string, campaignId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: { leads: { select: { id: true } } },
    });

    if (!campaign) throw new Error('Campaign not found');

    const existingLeadIds = new Set(campaign.leads.map(l => l.id));
    const newLeadIds = leadIds.filter(id => !existingLeadIds.has(id));

    if (newLeadIds.length === 0) {
      return { added: 0, skipped: leadIds.length };
    }

    await prisma.lead.updateMany({
      where: { id: { in: newLeadIds }, userId },
      data: {
        campaignId,
        outreachStatus: 'PENDING',
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

    return { added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length };
  }

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
        domainLinks: {
          include: { domain: true },
        },
      },
    });

    if (!campaign) return null;

    const queuedCount = await prisma.pendingEmail.count({
      where: { userId, campaignId, status: 'PENDING' },
    });

    return {
      ...campaign,
      queuedCount,
    };
  }

  async getCampaignDomains(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        domainLinks: {
          include: { domain: true },
        },
      },
    });
    if (!campaign) throw new Error('Campaign not found');
    return campaign.domainLinks.map(link => link.domain);
  }

  async addDomainToCampaign(userId: string, campaignId: string, domainId: string) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');

    return prisma.campaignDomain.create({
      data: { campaignId, domainId },
    });
  }

  async removeDomainFromCampaign(userId: string, campaignId: string, domainId: string) {
    const link = await prisma.campaignDomain.findFirst({
      where: { campaignId, domainId },
      include: { campaign: true },
    });
    if (!link || link.campaign.userId !== userId) throw new Error('Link not found or unauthorized');
    await prisma.campaignDomain.delete({ where: { id: link.id } });
  }
}

export const campaignService = new CampaignService();