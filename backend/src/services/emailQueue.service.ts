import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { getNextActiveTime } from '../utils/timezone';

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
    const sentToday = settings.sentCount;

    if (sentToday >= limit) {
      logger.debug({ userId }, 'Send limit reached');
      return;
    }

    const intervalMs = this.getSendIntervalMs(settings);

    // If we have a lastSend, check if we need to wait
    if (settings.lastSend) {
      const timeSinceLast = now.getTime() - new Date(settings.lastSend).getTime();
      if (timeSinceLast < intervalMs) {
        logger.debug({ userId, timeSinceLast, intervalMs }, 'Interval not yet elapsed, skipping this user for now');
        return; // do not process any emails for this user this cycle
      }
    }

    // Find the oldest pending email (already sorted by createdAt)
    const email = emails[0];
    if (!email) return;

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
        logger.debug({ userId, emailId: email.id, nextTime }, 'Email rescheduled due to active hours');
        return; // skip this user for now (other emails will be processed in future cycles)
      }
    }

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

        // Update user's sentCount and lastSend
        await prisma.userSettings.update({
          where: { userId },
          data: {
            sentCount: { increment: 1 },
            lastSend: new Date(),
          },
        });

        logger.info({ leadId: email.leadId, userId, sentCount: sentToday + 1 }, 'Email sent from queue');
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
        logger.error({ userId, emailId: email.id, error: result.error }, 'Email sending failed');
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
    // After sending (or failing) one email, we exit. The next email will be picked up in the next cycle.
  }

  private getPeriodMinutes(period: string): number {
    switch (period) {
      case 'day': return 24 * 60;
      case 'week': return 7 * 24 * 60;
      case 'month': return 30 * 24 * 60;
      default: return 24 * 60;
    }
  }

  private getSendIntervalMs(settings: any): number {
    const periodSec = this.getPeriodMinutes(settings.sendPeriod) * 60;
    return (periodSec * 1000) / settings.sendLimit;
  }
}

export const emailQueueService = new EmailQueueService();