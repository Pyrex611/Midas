import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { getNextActiveTime } from '../utils/timezone';

// Limit how many emails we process per user per queue run (safety)
const MAX_EMAILS_PER_RUN_PER_USER = 20;

export class EmailQueueService {
  private interval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  start(intervalMs: number = 60 * 1000) {
    if (this.interval) return;
    logger.info(`Email queue processor started (interval: ${intervalMs}ms)`);
    this.interval = setInterval(() => this.processQueue(), intervalMs);
    this.processQueue(); // run immediately
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Email queue processor stopped');
    }
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      // Get all pending emails that are due now (scheduledAt <= now or null)
      const now = new Date();
      const pending = await prisma.pendingEmail.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { scheduledAt: null },
            { scheduledAt: { lte: now } },
          ],
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          user: {
            include: { settings: true },
          },
          campaign: true,
          lead: true,
          draft: true,
        },
      });

      // Group by user
      const byUser = new Map();
      for (const email of pending) {
        if (!byUser.has(email.userId)) byUser.set(email.userId, []);
        byUser.get(email.userId).push(email);
      }

      for (const [userId, emails] of byUser) {
        await this.processUserEmails(userId, emails);
      }
    } catch (error) {
      logger.error({ error }, 'Email queue processing error');
    } finally {
      this.isProcessing = false;
    }
  }

  private async processUserEmails(userId: string, emails: any[]) {
    const settings = emails[0]?.user.settings;
    if (!settings) {
      logger.warn({ userId }, 'No email settings, skipping');
      return;
    }

    // Reset sent count and lastSend if period has passed
    const now = new Date();
    const lastReset = new Date(settings.lastSentReset);
    const periodMinutes = this.getPeriodMinutes(settings.sendPeriod);
    const minutesSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60);
    if (minutesSinceReset >= periodMinutes) {
      await prisma.userSettings.update({
        where: { userId },
        data: {
          sentCount: 0,
          lastSentReset: now,
          lastSend: null, // allow immediate sending after reset
        },
      });
      settings.sentCount = 0;
      settings.lastSend = null;
    }

    const limit = settings.sendLimit;
    let sentToday = settings.sentCount;

    // If limit reached, skip
    if (sentToday >= limit) {
      logger.debug({ userId }, 'Send limit reached');
      return;
    }

    // Calculate minimum interval between sends (in ms)
    const intervalMs = this.getSendIntervalMs(settings);

    // Enforce last send time
    if (settings.lastSend) {
      const timeSinceLast = now.getTime() - new Date(settings.lastSend).getTime();
      if (timeSinceLast < intervalMs) {
        logger.debug({ userId }, `Last send was ${timeSinceLast}ms ago, need ${intervalMs}ms – skipping this cycle`);
        return;
      }
    }

    // Process up to MAX_EMAILS_PER_RUN_PER_USER (safety)
    const emailsToProcess = emails.slice(0, MAX_EMAILS_PER_RUN_PER_USER);

    for (const email of emailsToProcess) {
      // Check campaign active window
      const campaign = email.campaign;
      if (campaign.activeStartHour != null && campaign.activeEndHour != null) {
        const nextTime = getNextActiveTime(now, campaign.activeStartHour, campaign.activeEndHour);
        if (nextTime.getTime() > now.getTime()) {
          // Not in window; reschedule
          await prisma.pendingEmail.update({
            where: { id: email.id },
            data: { scheduledAt: nextTime },
          });
          continue;
        }
      }

      // Double‑check limit (may have been reached by previous sends in same cycle)
      if (sentToday >= limit) break;

      try {
        // Personalise
        const { subject, body } = personalisationService.personalise(
          email.lead,
          email.subject,
          email.body,
          email.campaign.reference,
          email.campaign.senderName
        );

        const result = await emailService.sendEmailNow(
          userId,
          email.lead.email,
          subject,
          body.replace(/\n/g, '<br>'),
          body,
          email.campaign.senderName,
          email.inReplyTo
        );

        if (result.success) {
          // Record sent email
          await prisma.outboundEmail.create({
            data: {
              userId,
              leadId: email.leadId,
              campaignId: email.campaignId,
              draftId: email.draftId,
              subject,
              body,
              status: 'SENT',
              sentAt: new Date(),
              messageId: result.messageId,
              replyToId: email.inReplyTo ? undefined : undefined,
            },
          });

          // Update lead status
          await prisma.lead.update({
            where: { id: email.leadId },
            data: { outreachStatus: 'SENT', status: 'CONTACTED' },
          });

          // Increment draft sent count
          if (email.draftId) {
            await prisma.draft.update({
              where: { id: email.draftId },
              data: { sentCount: { increment: 1 } },
            });
          }

          // Delete pending email
          await prisma.pendingEmail.delete({ where: { id: email.id } });

          sentToday++;
          // Update user's sentCount and lastSend
          await prisma.userSettings.update({
            where: { userId },
            data: {
              sentCount: { increment: 1 },
              lastSend: new Date(),
            },
          });

          logger.info({ leadId: email.leadId, pendingId: email.id }, 'Email sent from queue');
        } else {
          // Mark as failed
          await prisma.pendingEmail.update({
            where: { id: email.id },
            data: { status: 'FAILED', error: result.error },
          });
          await prisma.lead.update({
            where: { id: email.leadId },
            data: { outreachStatus: 'FAILED' },
          });
        }
      } catch (error: any) {
        logger.error({ error, pendingId: email.id }, 'Failed to process queued email');
        await prisma.pendingEmail.update({
          where: { id: email.id },
          data: { status: 'FAILED', error: error.message },
        });
        await prisma.lead.update({
          where: { id: email.leadId },
          data: { outreachStatus: 'FAILED' },
        });
      }
    }
  }

  private getPeriodMinutes(period: string): number {
    switch (period) {
      case 'day': return 24 * 60;
      case 'week': return 7 * 24 * 60;
      case 'month': return 30 * 24 * 60;
      default: return 24 * 60;
    }
  }

  private getPeriodSeconds(period: string): number {
    return this.getPeriodMinutes(period) * 60;
  }

  private getSendIntervalMs(settings: any): number {
    const periodSec = this.getPeriodSeconds(settings.sendPeriod);
    return (periodSec * 1000) / settings.sendLimit;
  }
}

export const emailQueueService = new EmailQueueService();