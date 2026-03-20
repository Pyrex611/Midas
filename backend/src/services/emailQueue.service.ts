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
      // 1. CONNECTION GUARD: Ensure DB is reachable before pulling large datasets
      await prisma.$queryRaw`SELECT 1`.catch(() => { throw new Error('CONNECTION_LIMIT_HIT') });

      const now = new Date();
      const pending = await prisma.pendingEmail.findMany({
        where: {
          status: 'PENDING',
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: {
          campaign: {
            include: {
              mailboxLinks: { include: { mailbox: true } },
            },
          },
          lead: true,
          draft: true,
          preferredMailbox: true,
        },
      });

      if (pending.length === 0) {
        this.isProcessing = false;
        return;
      }

      // 2. GROUPING: Batch emails by campaign to avoid redundant mailbox selection lookups
      const byCampaign = new Map<string, any[]>();
      for (const email of pending) {
        if (!byCampaign.has(email.campaignId)) byCampaign.set(email.campaignId, []);
        byCampaign.get(email.campaignId)!.push(email);
      }

      // 3. EXECUTION: Process each campaign batch
      for (const [campaignId, emails] of byCampaign) {
        await this.processCampaignEmails(campaignId, emails);
      }

    } catch (error: any) {
      if (error.message === 'CONNECTION_LIMIT_HIT' || error.message.includes('MaxClients')) {
        logger.warn('Queue: Database pool exhausted. Skipping cycle to allow cooldown.');
      } else {
        logger.error({ error }, 'Email queue processing error');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process all pending emails for a specific campaign.
   */
  private async processCampaignEmails(campaignId: string, emails: any[]) {
    const campaign = emails[0].campaign;
    
    // 1. Guard: Ensure campaign has mailboxes attached
    if (!campaign.mailboxLinks || campaign.mailboxLinks.length === 0) {
      logger.debug({ campaignId }, 'Skipping cycle: No mailboxes linked to campaign.');
      return; 
    }

    for (const email of emails) {
      // 2. Active Hours Check
      if (campaign.activeStartHour != null && campaign.activeEndHour != null) {
				const now = new Date();
				
				// 🔥 Passing the 4th parameter: campaign.timezone
				const nextTime = getNextActiveTime(
					now, 
					campaign.activeStartHour, 
					campaign.activeEndHour, 
					campaign.timezone || 'UTC' 
				);

				if (nextTime.getTime() > now.getTime()) {
					await prisma.pendingEmail.update({ 
						where: { id: email.id }, 
						data: { scheduledAt: nextTime } 
					});
					continue; 
				}
			}

      // 3. Mailbox Selection (Round-robin or Preferred)
      const selection = await mailboxService.selectMailboxForCampaign(campaignId, email.preferredMailboxId);
      
      if (!selection) {
        logger.warn({ campaignId }, 'No healthy/available mailbox found in pool.');
        return; // Pause processing for this campaign this cycle
      }

      // 4. 🔥 THE FIX: Explicitly fetch the decrypted mailbox credentials
      // This ensures smtpPass is plain text, not the encrypted hex string.
      let decryptedMailbox;
      try {
        decryptedMailbox = await mailboxService.getMailboxForSending(selection.mailbox.id);
      } catch (err) {
        logger.error({ mailboxId: selection.mailbox.id }, 'Failed to decrypt mailbox credentials');
        continue;
      }

      // 5. Quota & Interval Check
      const mailboxWithStats = await this.prepareMailboxStats(decryptedMailbox);
      if (!mailboxWithStats.canSend) {
        logger.debug({ mailboxId: decryptedMailbox.id }, 'Mailbox at limit or waiting for interval.');
        continue; 
      }

      try {
        // 6. Personalization
        const { subject, body } = personalisationService.personalise(
          email.lead,
          email.subject,
          email.body,
          campaign.reference,
          campaign.senderName
        );

        // 7. Execution: Attempt SMTP Send
        const result = await emailService.sendEmailNow(
          decryptedMailbox, // Passing the decrypted object
          email.lead.email,
          subject,
          body.replace(/\n/g, '<br>'),
          body,
          campaign.senderName,
          email.inReplyTo
        );

        if (result.success) {
          // 8. Atomic Transaction: Record outcome and cleanup
          await prisma.$transaction([
            prisma.outboundEmail.create({
              data: {
                mailboxId: decryptedMailbox.id,
                leadId: email.leadId,
                campaignId,
                draftId: email.draftId,
                userId: email.userId,
                subject,
                body,
                status: 'SENT',
                sentAt: new Date(),
                messageId: result.messageId,
              },
            }),
            prisma.pendingEmail.delete({ where: { id: email.id } }),
            prisma.lead.update({
              where: { id: email.leadId },
              data: { outreachStatus: 'SENT', status: 'CONTACTED' },
            }),
            // Increment lifetime metrics (Phase 4.5c)
            prisma.mailbox.update({
              where: { id: decryptedMailbox.id },
              data: { 
                totalSent: { increment: 1 },
                status: 'HEALTHY',
                lastError: null 
              }
            })
          ]);

          // Update volatile stats (daily counts)
          await this.updateMailboxStats(decryptedMailbox.id);
          
          logger.info({ 
            lead: email.lead.email, 
            mailbox: decryptedMailbox.email 
          }, 'Email dispatched successfully.');

          // BREAK: Process only one email per campaign per cycle to respect intervals
          break; 
        } else {
          // 9. Failure Handling: Check for Authentication Errors
          const isAuthError = result.error?.includes('535') || result.error?.toLowerCase().includes('invalid login');

          if (isAuthError) {
            await prisma.mailbox.update({
              where: { id: decryptedMailbox.id },
              data: { 
                status: 'LOCKED', 
                lastError: 'Authentication Failed: Re-check App Password on Server.' 
              }
            });
            logger.error({ mailbox: decryptedMailbox.email }, 'Mailbox LOCKED due to Bad Credentials.');
          }

          await prisma.pendingEmail.update({
            where: { id: email.id },
            data: { 
              status: 'FAILED', 
              error: result.error || 'Unknown SMTP error' 
            }
          });
        }
      } catch (error: any) {
        logger.error({ error, pendingId: email.id }, 'Fatal error in queue dispatch loop');
        await prisma.pendingEmail.update({
          where: { id: email.id },
          data: { status: 'FAILED', error: error.message },
        });
      }
      break; 
    }
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