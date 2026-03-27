import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { mailboxService } from './mailbox.service';
import { getNextActiveTime } from '../utils/timezone';

export class EmailQueueService {
  private interval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Start the queue processor loop.
   */
  start(intervalMs: number = 60 * 1000) {
    if (this.interval) return;
    logger.info(`Email queue processor started (interval: ${intervalMs}ms)`);
    this.interval = setInterval(() => this.processQueue(), intervalMs);
    this.processQueue(); // Run immediately on start
  }

  /**
   * Stop the queue processor loop.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Email queue processor stopped');
    }
  }

  /**
   * Primary loop: Fetches all PENDING emails and groups them by campaign for processing.
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      // Pre-check DB connection
      await prisma.$queryRaw`SELECT 1`.catch(() => { throw new Error('DB_DOWN') });

      const now = new Date();
      const pending = await prisma.pendingEmail.findMany({
        where: {
          status: 'PENDING',
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: {
          campaign: { include: { mailboxLinks: { include: { mailbox: true } } } },
          lead: true,
        },
      });

      // Group by campaign
      const byCampaign = new Map();
      for (const email of pending) {
        if (!byCampaign.has(email.campaignId)) byCampaign.set(email.campaignId, []);
        byCampaign.get(email.campaignId).push(email);
      }

      for (const [campaignId, emails] of byCampaign) {
        await this.processCampaignEmails(campaignId, emails);
      }
    } catch (error: any) {
      logger.warn('Queue cycle skipped: Database busy or connection limit reached.');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process all pending emails for a specific campaign.
   */
  private async processCampaignEmails(campaignId: string, emails: any[]) {
    const campaign = emails[0].campaign;
    
    // 1. Get ONLY active, healthy mailboxes from the pool
    const pool = campaign.mailboxLinks
      .map((link: any) => link.mailbox)
      .filter((m: any) => m.isActive && m.status === 'HEALTHY');

    if (pool.length === 0) return;

    // 2. Track mailboxes used in this 1-minute cycle to prevent double-sends from one account
    const usedInThisBurst = new Set<string>();

    for (const email of emails) {
      // Stop if we have filled all available mailbox "slots" for this minute
      if (usedInThisBurst.size >= pool.length) break;

      // 3. Timezone / Active Hours Check
      if (campaign.activeStartHour != null && campaign.activeEndHour != null) {
        const nextTime = getNextActiveTime(new Date(), campaign.activeStartHour, campaign.activeEndHour, campaign.timezone || 'UTC');
        if (nextTime.getTime() > Date.now()) {
          await prisma.pendingEmail.update({ where: { id: email.id }, data: { scheduledAt: nextTime } });
          continue; 
        }
      }

      // 4. Select a mailbox that is ready (Not on interval cooldown, not used in this burst)
      const selection = await this.findReadyMailbox(pool, usedInThisBurst, email.preferredMailboxId, campaign);
      if (!selection) continue;

      try {
        const decryptedMailbox = await mailboxService.getMailboxForSending(selection.id);

        const { subject, body } = personalisationService.personalise(
          email.lead, email.subject, email.body, campaign.reference, campaign.senderName
        );

        const result = await emailService.sendEmailNow(
          decryptedMailbox, email.lead.email, subject, body.replace(/\n/g, '<br>'), body, campaign.senderName, email.inReplyTo
        );

        if (result.success) {
          // 5. ATOMIC UPDATE: Record success and increment counters
          await prisma.$transaction([
            prisma.outboundEmail.create({
              data: {
                mailboxId: decryptedMailbox.id,
                leadId: email.leadId,
                campaignId,
                userId: campaign.userId,
                subject, body, status: 'SENT', sentAt: new Date(), messageId: result.messageId,
              },
            }),
            prisma.pendingEmail.delete({ where: { id: email.id } }),
            prisma.lead.update({
              where: { id: email.leadId },
              data: { outreachStatus: 'SENT', status: 'CONTACTED' }
            }),
            // Increment lifetime and daily counters on the specific mailbox
            prisma.mailbox.update({
              where: { id: decryptedMailbox.id },
              data: { 
                totalSent: { increment: 1 },
                sentCount: { increment: 1 }, // 🔥 Daily Counter
                lastSend: new Date(),
                status: 'HEALTHY'
              }
            })
          ]);
          
          usedInThisBurst.add(decryptedMailbox.id);
          logger.info({ lead: email.lead.email, mailbox: decryptedMailbox.email }, 'Sent successfully in burst mode.');
        } else {
          // Handle Error (Check for auth failure 535)
          if (result.error?.includes('535')) {
            await prisma.mailbox.update({
              where: { id: decryptedMailbox.id },
              data: { status: 'LOCKED', lastError: 'Auth Failed' }
            });
          }
          await prisma.pendingEmail.update({ where: { id: email.id }, data: { status: 'FAILED', error: result.error } });
        }
      } catch (err) {
        logger.error('Item dispatch failed');
      }
    }
  }

	private async findReadyMailbox(pool: any[], usedIds: Set<string>, preferredId: string | null, campaign: any) {
    // A. Priority: Follow-up Integrity
    if (preferredId) {
      const pref = pool.find(m => m.id === preferredId);
      if (pref && !usedIds.has(pref.id)) {
        const availability = await this.checkMailboxAvailability(pref);
        if (availability) return pref;
      }
      return null; // Force wait for the correct mailbox for follow-ups
    }

    // B. Round-Robin Search
    for (let i = 0; i < pool.length; i++) {
      const idx = (campaign.lastMailboxIndex + i) % pool.length;
      const candidate = pool[idx];

      if (usedIds.has(candidate.id)) continue;

      const ready = await this.checkMailboxAvailability(candidate);
      if (ready) {
        // Update campaign index for next attempt
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { lastMailboxIndex: (idx + 1) % pool.length }
        });
        return candidate;
      }
    }
    return null;
  }
	
	private async checkMailboxAvailability(mailbox: any): Promise<boolean> {
    const now = new Date();
    
    // 1. Daily Reset Check
    const lastReset = new Date(mailbox.lastSentReset);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceReset >= 24) {
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { sentCount: 0, lastSentReset: now }
      });
      mailbox.sentCount = 0;
    }

    // 2. Daily Limit Check
    if (mailbox.sentCount >= mailbox.sendLimit) return false;

    // 3. Interval Cooldown Check (e.g., 50/day = ~28 mins)
    if (mailbox.lastSend) {
      const intervalMs = (24 * 60 * 60 * 1000) / mailbox.sendLimit;
      const timeSinceLast = now.getTime() - new Date(mailbox.lastSend).getTime();
      if (timeSinceLast < intervalMs) return false;
    }

    return true;
  }

  /**
   * Ensures the mailbox is within its daily send limits and respects the spacing interval.
   */
  private async prepareMailboxStats(mailbox: any): Promise<{ canSend: boolean; mailbox: any }> {
    const now = new Date();
    const lastReset = new Date(mailbox.lastSentReset);
    const periodMinutes = this.getPeriodMinutes(mailbox.sendPeriod);
    const minutesSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60);
    
    // Auto-Reset Quota if the period (day/week/month) has passed
    if (minutesSinceReset >= periodMinutes) {
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { sentCount: 0, lastSentReset: now, lastSend: null },
      });
      mailbox.sentCount = 0;
      mailbox.lastSend = null;
    }

    // Check Hard Limit
    if (mailbox.sentCount >= mailbox.sendLimit) return { canSend: false, mailbox };

    // Check Spacing Interval (e.g. if limit is 50/day, only send every ~28 mins)
    const intervalMs = this.getSendIntervalMs(mailbox);
    if (mailbox.lastSend) {
      const timeSinceLast = now.getTime() - new Date(mailbox.lastSend).getTime();
      if (timeSinceLast < intervalMs) return { canSend: false, mailbox };
    }
    return { canSend: true, mailbox };
  }

  private async updateMailboxStats(mailboxId: string) {
    await prisma.mailbox.update({
      where: { id: mailboxId },
      data: { sentCount: { increment: 1 }, lastSend: new Date() },
    });
  }

  private getPeriodMinutes(period: string): number {
    switch (period) {
      case 'day': return 24 * 60;
      case 'week': return 7 * 24 * 60;
      case 'month': return 30 * 24 * 60;
      default: return 24 * 60;
    }
  }

  private getSendIntervalMs(mailbox: any): number {
    const periodSec = this.getPeriodMinutes(mailbox.sendPeriod) * 60;
    // Calculate total seconds in period / limit. Add jitter to look human.
    const baseInterval = (periodSec * 1000) / mailbox.sendLimit;
    const jitter = Math.random() * 0.1 * baseInterval; // 10% jitter
    return baseInterval + jitter;
  }
}

export const emailQueueService = new EmailQueueService();