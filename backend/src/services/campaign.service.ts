import { OutreachStatus, CampaignRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service'; // 🔥 Fixed: Added missing import
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
  /**
   * Create a new campaign with Analytical Sequence Strategy.
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
    sendHourUTC?: number,
    objective?: string
  ) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error(`Invalid userId format: ${userId}. Expected a UUID.`);
    }

    try {
      const campaign = await prisma.$transaction(async (tx) => {
        const newCampaign = await tx.campaign.create({
          data: {
            userId,
            name,
            description,
            context,
            reference,
            objective,
            status: leadIds?.length ? 'ACTIVE' : 'DRAFT',
            startedAt: leadIds?.length ? new Date() : null,
            autoReplyEnabled: autoReplyEnabled ?? false,
            sendHourUTC: sendHourUTC ?? 9,
            ...(leadIds?.length && {
              leads: { connect: leadIds.map(id => ({ id })) },
            }),
          },
        });

        // Add creator as OWNER
        await tx.campaignMember.create({
          data: {
            campaignId: newCampaign.id,
            userId: userId,
            role: 'OWNER',
          },
        });

        // ANALYTICAL STRATEGY GENERATION (Phase 4.5d)
        const hasRef = !!reference;
        const strategy = [
          { 
            step: 1, 
            delay: 3, 
            goal: "Establish logic and share a new perspective on the problem." 
          },
          { 
            step: 2, 
            delay: 6, 
            goal: hasRef 
              ? "Prove credibility by mentioning a success story ({{reference_company}})." 
              : "Highlight the negative cost of inaction/ignoring this issue." 
          },
          { 
            step: 3, 
            delay: 10, 
            goal: "Direct closing attempt. Ask a 'No-Oriented' question to reduce friction." 
          }
        ];

        for (const s of strategy) {
          await tx.followUpStep.create({
            data: {
              campaignId: newCampaign.id,
              stepNumber: s.step,
              delayDays: s.delay,
              microObjective: s.goal
            }
          });
        }

        if (leadIds?.length) {
          await tx.lead.updateMany({
            where: { id: { in: leadIds }, userId },
            data: { outreachStatus: 'PENDING' as OutreachStatus },
          });
        }

        return newCampaign;
      });

      // Initial Outreach Generation
      await draftService.generateMultipleDrafts(
        userId, 3, 'professional', 'initial', 
        campaign.id, context, reference, undefined, senderName, undefined, objective
      );

      // Analytical Follow-up Generation (Step-aware)
      const steps = await prisma.followUpStep.findMany({ where: { campaignId: campaign.id } });
      for (const step of steps) {
        await draftService.generateAndSaveDraft(
          userId, 'professional', 'followup', 
          campaign.id, context, reference, undefined, senderName, 
          step.stepNumber, objective, step.microObjective
        );
      }

      if (leadIds?.length) {
        this.processCampaign(userId, campaign.id).catch(err => {
          logger.error({ err, campaignId: campaign.id }, 'Background processing failed');
        });
      }

      return campaign;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create strategic campaign');
      throw error;
    }
  }

  /**
   * Process leads in a campaign (initial outreach).
   */
  private async processCampaign(userId: string, campaignId: string, specificLeadIds?: string[]) {
    try {
      const drafts = await prisma.draft.findMany({
        where: { userId, campaignId, isActive: true, useCase: 'initial' },
      });

      if (drafts.length === 0) return;

      const whereClause: any = { userId, campaignId };
      if (specificLeadIds) {
        whereClause.id = { in: specificLeadIds };
      } else {
        whereClause.outreachStatus = { in: ['PENDING', 'PROCESSING'] };
      }

      const leads = await prisma.lead.findMany({ where: whereClause });
      const campaign = await prisma.campaign.findFirst({ where: { id: campaignId } });

      if (leads.length === 0) return;

      for (const lead of leads) {
        try {
          const randomIndex = Math.floor(Math.random() * drafts.length);
          const draft = drafts[randomIndex];

          await prisma.lead.update({
            where: { id: lead.id },
            data: { outreachStatus: 'PROCESSING' as OutreachStatus },
          });

          // 🔥 This is where the ReferenceError was occurring
          const { subject, body } = personalisationService.personalise(
            lead as any,
            draft.subject,
            draft.body,
            campaign?.reference,
            campaign?.senderName
          );

          await emailService.queueEmail(
            userId,
            campaignId,
            lead.id,
            draft.id,
            subject,
            body
          );

          await prisma.lead.update({
            where: { id: lead.id },
            data: { outreachStatus: 'QUEUED' as OutreachStatus },
          });
        } catch (error: any) {
          logger.error({ error, leadId: lead.id }, 'Error processing lead');
          await prisma.lead.update({
            where: { id: lead.id },
            data: { outreachStatus: 'FAILED' as OutreachStatus },
          });
        }
      }
    } catch (error) {
      logger.error({ error, userId, campaignId }, 'Fatal error in processCampaign');
    }
  }

  /**
   * Add leads to an existing campaign.
   */
  async addLeadsToCampaign(userId: string, campaignId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId },
      include: { leads: { select: { id: true } } },
    });

    if (!campaign) throw new Error('Campaign not found');

    const existingLeadIds = new Set(campaign.leads.map(l => l.id));
    const newLeadIds = leadIds.filter(id => !existingLeadIds.has(id));

    if (newLeadIds.length === 0) return { added: 0, skipped: leadIds.length };

    await prisma.lead.updateMany({
      where: { id: { in: newLeadIds } },
      data: {
        campaignId,
        outreachStatus: 'PENDING' as OutreachStatus,
      },
    });

    this.processCampaign(userId, campaignId, newLeadIds).catch(err => {
      logger.error({ err, userId, campaignId }, 'Background lead processing failed');
    });

    return { added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length };
  }

  async getCampaigns(userId: string) {
    return prisma.campaign.findMany({
      where: {
        OR: [
          { userId: userId },
          { members: { some: { userId: userId } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { leads: true, emails: true, drafts: true } },
        members: { where: { userId }, select: { role: true } }
      },
    });
  }

  async getCampaignDetails(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { userId: userId },
          { members: { some: { userId: userId } } }
        ]
      },
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true } } } },
        leads: { select: { id: true, name: true, email: true, company: true, status: true, outreachStatus: true } },
        drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
        emails: { orderBy: { sentAt: 'desc' }, take: 50 },
        followUpSteps: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!campaign) return null;

    const stepsWithCounts = await Promise.all(
      campaign.followUpSteps.map(async (step) => {
        const draftCount = await prisma.draft.count({
          where: { campaignId, stepNumber: step.stepNumber, isActive: true },
        });
        return { ...step, draftCount };
      })
    );

    const queuedCount = await prisma.pendingEmail.count({
      where: { campaignId, status: 'PENDING' },
    });

    return { ...campaign, followUpSteps: stepsWithCounts, queuedCount };
  }

  async updateAutoReplySettings(userId: string, campaignId: string, autoReplyEnabled: boolean) {
    return prisma.campaign.update({ where: { id: campaignId }, data: { autoReplyEnabled } });
  }

  async updateSendHour(userId: string, campaignId: string, sendHourUTC: number) {
    return prisma.campaign.update({ where: { id: campaignId }, data: { sendHourUTC } });
  }

  async updateActiveHours(userId: string, id: string, activeStartHour?: number | null, activeEndHour?: number | null, timezone?: string | null) {
    return prisma.campaign.update({ where: { id }, data: { activeStartHour, activeEndHour, timezone } });
  }

  async setFollowUpSteps(userId: string, campaignId: string, steps: { stepNumber: number; delayDays: number; microObjective?: string }[]) {
    return prisma.$transaction(async (tx) => {
      await tx.followUpStep.deleteMany({ where: { campaignId } });
      return Promise.all(
        steps.map(step =>
          tx.followUpStep.create({
            data: { campaignId, stepNumber: step.stepNumber, delayDays: step.delayDays, microObjective: step.microObjective },
          })
        )
      );
    });
  }

  async deleteFollowUpStep(userId: string, stepId: string) {
    await prisma.followUpStep.delete({ where: { id: stepId } });
  }

  async getCampaignMailboxes(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId },
      include: { mailboxLinks: { include: { mailbox: true } } },
    });
    if (!campaign) throw new Error('Campaign not found');
    return campaign.mailboxLinks.map(link => link.mailbox);
  }

  async addMailboxToCampaign(userId: string, campaignId: string, mailboxId: string) {
    return prisma.campaignMailbox.create({ data: { campaignId, mailboxId } });
  }

  async removeMailboxFromCampaign(userId: string, campaignId: string, mailboxId: string) {
    const link = await prisma.campaignMailbox.findFirst({ where: { campaignId, mailboxId } });
    if (link) await prisma.campaignMailbox.delete({ where: { id: link.id } });
  }
}