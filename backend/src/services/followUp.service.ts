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
      // Get all campaigns with at least one follow‑up step enabled
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

      for (const campaign of campaigns) {
        const userId = campaign.userId;
        // Get all leads in this campaign that have been contacted (initial email sent)
        const leads = await prisma.lead.findMany({
          where: {
            campaignId: campaign.id,
            outreachStatus: 'SENT',
          },
          include: {
            sentEmails: {
              where: { isIncoming: false },
              orderBy: { sentAt: 'asc' },
              take: 1, // initial email
            },
          },
        });

        for (const lead of leads) {
          const initialEmail = lead.sentEmails[0];
          if (!initialEmail) continue;

          // Check if lead has replied since initial email
          const hasReplied = await prisma.outboundEmail.findFirst({
            where: {
              leadId: lead.id,
              campaignId: campaign.id,
              isIncoming: true,
              sentAt: { gt: initialEmail.sentAt },
            },
          });
          if (hasReplied) continue; // replied, no further follow‑ups needed

          // Determine which follow‑up steps have already been sent for this lead
          const sentSteps = await prisma.outboundEmail.findMany({
            where: {
              leadId: lead.id,
              campaignId: campaign.id,
              isIncoming: false,
              NOT: { id: initialEmail.id },
            },
            orderBy: { sentAt: 'asc' },
          });

          const sentStepNumbers = new Set<number>();
          // We need to know which step each sent email corresponds to.
          // We can infer by counting them in order (step1 = first sent follow-up, step2 = second, etc.)
          // This assumes steps are sent sequentially without skipping.
          sentSteps.forEach((_, index) => {
            sentStepNumbers.add(index + 1); // first follow-up is step1
          });

          for (const step of campaign.followUpSteps) {
            // If this step already sent, skip
            if (sentStepNumbers.has(step.stepNumber)) continue;

            // Calculate target time: initialEmail.sentAt + step.delayDays days, adjusted to sendHourUTC
            const targetDate = new Date(initialEmail.sentAt);
            targetDate.setDate(targetDate.getDate() + step.delayDays);
            targetDate.setUTCHours(campaign.sendHourUTC, 0, 0, 0);

            const now = new Date();

            if (now >= targetDate) {
              // Send this step
              await this.sendFollowUp(userId, lead.id, campaign.id, step, initialEmail);
              // Once sent, we'll break? Actually we should send only the next step that is due, but if multiple steps are due, send them in order.
              // Since we are iterating in ascending step order, and we check >= targetDate, we may send multiple steps if they are all due.
              // That's acceptable – but to avoid sending too many at once, we could add a small buffer.
              // For now, we'll send all due steps.
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Follow‑up check failed');
    } finally {
      this.isRunning = false;
    }
  }

  private async sendFollowUp(
    userId: string,
    leadId: string,
    campaignId: string,
    step: any,
    initialEmail: any
  ) {
    try {
      const [lead, campaign] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.campaign.findUnique({ where: { id: campaignId } }),
      ]);
      if (!lead || !campaign) return;

      // Determine which draft to use (step-specific or campaign's best)
      let draft;
      if (step.draftId) {
        draft = await prisma.draft.findUnique({ where: { id: step.draftId } });
      } else {
        draft = await draftService.getBestDraft(userId, 'followup', 'professional', campaignId);
      }
      if (!draft) {
        logger.warn({ leadId, campaignId, step }, 'No follow‑up draft available');
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
        initialEmail.messageId, // thread as reply to initial email
        userId
      );

      if (!result.success) throw new Error(result.error || 'Email sending failed');

      // Record sent follow‑up
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
          replyToId: initialEmail.id,
        },
      });

      await prisma.draft.update({
        where: { id: draft.id },
        data: { sentCount: { increment: 1 } },
      });

      logger.info({ leadId, campaignId, step: step.stepNumber }, 'Follow‑up sent');
    } catch (error) {
      logger.error({ error, leadId, campaignId }, 'Failed to send follow‑up');
    }
  }
}

export const followUpService = new FollowUpService();