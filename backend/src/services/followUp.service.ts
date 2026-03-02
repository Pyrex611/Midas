import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { env } from '../config/env';

const draftService = new DraftService();

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
      logger.info('Follow‑up scheduler stopped');
    }
  }

  async checkFollowUps() {
    if (this.isRunning) {
      logger.debug('Follow‑up check already running, skipping');
      return;
    }
    this.isRunning = true;
    try {
      logger.debug('Running follow‑up check');

      // Find all campaigns with follow‑ups enabled and active
      const campaigns = await prisma.campaign.findMany({
        where: {
          followUpEnabled: true,
          status: 'ACTIVE',
        },
        include: {
          leads: {
            where: {
              outreachStatus: 'SENT', // only leads that have been contacted
            },
            include: {
              sentEmails: {
                where: { isIncoming: false },
                orderBy: { sentAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      for (const campaign of campaigns) {
        const userId = campaign.userId; // capture for later use
        const delayHours = campaign.followUpDelay;
        const now = new Date();

        for (const lead of campaign.leads) {
          const lastOutbound = lead.sentEmails[0];
          if (!lastOutbound) continue;

          const hasReplied = await prisma.outboundEmail.findFirst({
            where: {
              leadId: lead.id,
              campaignId: campaign.id,
              isIncoming: true,
              sentAt: { gt: lastOutbound.sentAt },
            },
          });
          if (hasReplied) continue;

          const hoursSince = (now.getTime() - lastOutbound.sentAt.getTime()) / (1000 * 60 * 60);
          if (hoursSince >= delayHours) {
            await this.sendFollowUp(userId, lead.id, campaign.id, lastOutbound);
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Follow‑up check failed');
    } finally {
      this.isRunning = false;
    }
  }

  private async sendFollowUp(userId: string, leadId: string, campaignId: string, lastOutbound: any) {
    try {
      const [lead, campaign] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.campaign.findUnique({ where: { id: campaignId } }),
      ]);
      if (!lead || !campaign) return;

      // Get a follow‑up draft scoped to user
      const draft = await draftService.getBestDraft(userId, 'followup', 'professional', campaignId);
      if (!draft) {
        logger.warn({ leadId, campaignId }, 'No follow‑up draft available');
        return;
      }

      const { subject, body } = personalisationService.personalise(
        lead as any,
        draft.subject,
        draft.body,
        campaign.reference,
        campaign.senderName
      );

      const result = await emailService.sendEmail(
        lead.email,
        subject,
        body.replace(/\n/g, '<br>'),
        body,
        campaign.senderName,
        lastOutbound.messageId
      );

      if (!result.success) throw new Error(result.error || 'Email sending failed');

      // Record the sent follow‑up with userId
      await prisma.outboundEmail.create({
        data: {
          userId,
          leadId,
          campaignId,
          draftId: draft.id,
          subject,
          body,
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId,
          replyToId: lastOutbound.id,
        },
      });

      await prisma.draft.update({
        where: { id: draft.id },
        data: { sentCount: { increment: 1 } },
      });

      logger.info({ leadId, campaignId }, 'Follow‑up sent');
    } catch (error) {
      logger.error({ error, leadId, campaignId }, 'Failed to send follow‑up');
    }
  }
}

export const followUpService = new FollowUpService();