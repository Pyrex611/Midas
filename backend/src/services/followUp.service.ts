import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';

export class FollowUpService {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(intervalMs: number = 60 * 60 * 1000) {
    if (this.interval) return;
    logger.info(`Follow‑up scheduler started (interval: ${intervalMs}ms)`);
    this.interval = setInterval(() => this.checkFollowUps(), intervalMs);
    this.checkFollowUps();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkFollowUps() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { status: 'ACTIVE', followUpSteps: { some: { enabled: true } } },
        include: { followUpSteps: { where: { enabled: true }, orderBy: { stepNumber: 'asc' } } },
      });

      for (const campaign of campaigns) {
        // 🔥 PHASE 5c: Strict Guard
        // We only fetch leads that are NOT satisfied and have NOT explicitly replied
        const leads = await prisma.lead.findMany({
          where: {
            campaignId: campaign.id,
            outreachStatus: 'SENT',
            status: 'CONTACTED',
            isSatisfied: false, // Must not be satisfied
          },
          include: {
            sentEmails: {
              where: { isIncoming: false },
              orderBy: { sentAt: 'desc' },
              take: 1, // Look at the most recent sent email
            },
          },
        });

        for (const lead of leads) {
          const lastEmail = lead.sentEmails[0];
          if (!lastEmail) continue;

          // Double Check: Has lead replied *since* that last email?
          const freshReply = await prisma.outboundEmail.findFirst({
            where: {
              leadId: lead.id,
              isIncoming: true,
              sentAt: { gt: lastEmail.sentAt },
            },
          });

          if (freshReply) {
             // If they replied, we update status and stop follow-ups
             await prisma.lead.update({
               where: { id: lead.id },
               data: { status: 'REPLIED' }
             });
             continue; 
          }

          // Step Determination
          const sentFollowupsCount = await prisma.outboundEmail.count({
            where: { leadId: lead.id, campaignId: campaign.id, isIncoming: false, NOT: { id: lastEmail.id } }
          });

          for (const step of campaign.followUpSteps) {
            if (sentFollowupsCount >= step.stepNumber) continue;

            const targetDate = new Date(lastEmail.sentAt);
            targetDate.setDate(targetDate.getDate() + step.delayDays);
            targetDate.setUTCHours(campaign.sendHourUTC, 0, 0, 0);

            if (new Date() >= targetDate) {
              await this.sendFollowUp(campaign, lead, step, lastEmail);
              break; // Only one step per check
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Follow‑up cycle failed');
    } finally {
      this.isRunning = false;
    }
  }

  private async sendFollowUp(campaign: any, lead: any, step: any, lastEmail: any) {
    try {
      // Find the best draft for this specific step
      const draft = await prisma.draft.findFirst({
        where: { campaignId: campaign.id, stepNumber: step.stepNumber, isActive: true },
        orderBy: { replyCount: 'desc' }
      });

      if (!draft) return;

      const { subject, body } = personalisationService.personalise(
        lead, draft.subject, draft.body, campaign.reference, 
        campaign.senderName, campaign.targetTool, lastEmail.body
      );

      await emailService.queueEmail(
        campaign.userId, campaign.id, lead.id, draft.id, 
        subject, body, lastEmail.messageId, lastEmail.mailboxId
      );

      logger.info({ leadId: lead.id, step: step.stepNumber }, 'Follow-up queued.');
    } catch (error) {
      logger.error({ error, leadId: lead.id }, 'Failed to queue follow-up');
    }
  }
}

export const followUpService = new FollowUpService();