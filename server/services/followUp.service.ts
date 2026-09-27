import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { personalisationService } from './personalisation.service';

export class FollowUpService {

  async checkFollowUps(): Promise<{ queued: number; campaignsScanned: number }> {
    let queued = 0;
    let campaignsScanned = 0;
    try {
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: 'ACTIVE',
          followUpSteps: { some: { enabled: true } },
        },
        include: {
          followUpSteps: {
            where: { enabled: true },
            orderBy: { stepNumber: 'asc' },
          },
        },
      });
      campaignsScanned = campaigns.length;

      for (const campaign of campaigns) {
        const userId = campaign.userId;
        const leads = await prisma.lead.findMany({
          where: {
            campaignId: campaign.id,
            outreachStatus: 'SENT',
          },
          include: {
            sentEmails: {
              where: { isIncoming: false },
              orderBy: { sentAt: 'asc' },
              take: 1,
            },
          },
        });

        for (const lead of leads) {
          const initialEmail = lead.sentEmails[0];
          if (!initialEmail) continue;

          // Stop follow-ups if prospect replied
          const hasReplied = await prisma.outboundEmail.findFirst({
            where: {
              leadId: lead.id,
              campaignId: campaign.id,
              isIncoming: true,
            },
          });
          if (hasReplied) continue;

          // Verify both sent outbound and queued pending steps to prevent duplicates
          const sentOutbound = await prisma.outboundEmail.findMany({
            where: {
              leadId: lead.id,
              campaignId: campaign.id,
              isIncoming: false,
              NOT: { id: initialEmail.id },
            },
            include: { draft: true },
          });

          const queuedPending = await prisma.pendingEmail.findMany({
            where: {
              leadId: lead.id,
              campaignId: campaign.id,
            },
            include: { draft: true },
          });

          const completedStepNumbers = new Set<number>();
          sentOutbound.forEach(e => {
            if (e.draft?.stepNumber) completedStepNumbers.add(e.draft.stepNumber);
          });
          queuedPending.forEach(e => {
            if (e.draft?.stepNumber) completedStepNumbers.add(e.draft.stepNumber);
          });

          for (const step of campaign.followUpSteps) {
            if (completedStepNumbers.has(step.stepNumber)) continue;

            const targetDate = new Date(initialEmail.sentAt);
            targetDate.setDate(targetDate.getDate() + step.delayDays);

            if (new Date() >= targetDate) {
              const wasQueued = await this.sendFollowUp(
                userId,
                lead.id,
                campaign.id,
                step,
                initialEmail
              );
              if (wasQueued) queued++;
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Follow-up sequencer execution failed');
    }
    return { queued, campaignsScanned };
  }

  private async sendFollowUp(
    userId: string,
    leadId: string,
    campaignId: string,
    step: any,
    initialEmail: any
  ): Promise<boolean> {
    try {
      const [lead, campaign] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.campaign.findUnique({ where: { id: campaignId } }),
      ]);
      if (!lead || !campaign) return false;

      const draft = await prisma.draft.findFirst({
        where: {
          campaignId,
          useCase: 'followup',
          stepNumber: step.stepNumber,
          isActive: true,
        },
      });

      if (!draft) {
        logger.warn({ leadId, campaignId, stepNumber: step.stepNumber }, 'No follow-up draft available');
        return false;
      }

      const { subject, body } = personalisationService.personalise(
        lead,
        draft.subject,
        draft.body,
        campaign.reference,
        campaign.senderName
      );

      await prisma.pendingEmail.create({
        data: {
          userId,
          campaignId,
          leadId: lead.id,
          draftId: draft.id,
          subject,
          body,
          inReplyTo: initialEmail.messageId,
          domainId: initialEmail.domainId,
          status: 'PENDING',
        },
      });

      logger.info({ leadId, campaignId, step: step.stepNumber }, 'Follow-up queued in PendingEmail');
      return true;
    } catch (error) {
      logger.error({ error, leadId, campaignId }, 'Failed to queue follow-up');
      return false;
    }
  }
}

export const followUpService = new FollowUpService();