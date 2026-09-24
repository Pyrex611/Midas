import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from '../lib/unsubscribe';

export class EmailQueueService {

  private checkTimezone(timezone: string | null, startHour: number | null, endHour: number | null): boolean {
    if (startHour === null || startHour === undefined || endHour === null || endHour === undefined) return true;
    const tz = timezone || 'UTC';
    try {
      const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
      let currentHour = parseInt(formatter.format(new Date()), 10);
      if (currentHour === 24) currentHour = 0;

      return startHour <= endHour
        ? currentHour >= startHour && currentHour < endHour
        : currentHour >= startHour || currentHour < endHour;
    } catch (e) {
      return true;
    }
  }

  /**
   * Enforces the user's own configured send-rate cap (UserSettings.sendLimit
   * / sendPeriod), if they've set one. Previously this setting saved
   * correctly but was never actually checked anywhere — this is that
   * enforcement. Returns true if the user is at/over their limit for the
   * current period and this send should be deferred.
   */
  private async isOverUserSendLimit(userId: string): Promise<boolean> {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.sendLimit || !settings?.sendPeriod) return false;

    const periodStart = new Date();
    if (settings.sendPeriod === 'hour') {
      periodStart.setMinutes(0, 0, 0);
    } else {
      periodStart.setHours(0, 0, 0, 0);
    }

    const sentInPeriod = await prisma.outboundEmail.count({
      where: { userId, isIncoming: false, sentAt: { gte: periodStart } },
    });

    return sentInPeriod >= settings.sendLimit;
  }

  /**
   * Processes a batch of due PendingEmail rows and sends them.
   *
   * Safe to call concurrently/overlapping: rows are claimed with
   * `SELECT ... FOR UPDATE SKIP LOCKED`, so it's fine to have multiple
   * schedulers (Vercel Cron, a GitHub Actions backup poller, Upstash
   * QStash, and the opportunistic "trigger on write" calls from
   * controllers) hit this at the same time without double-sending anything.
   *
   * Returns a small summary so cron callers/monitors can see throughput
   * without needing to inspect logs.
   */
  async processQueue(): Promise<{ claimed: number; sent: number; deferred: number; failed: number; skippedUnsubscribed: number }> {
    const summary = { claimed: 0, sent: 0, deferred: 0, failed: 0, skippedUnsubscribed: 0 };
    // Cache one over-limit check per user per invocation instead of one per email.
    const userLimitCache = new Map<string, boolean>();

    try {
      await prisma.$executeRaw`
        UPDATE "PendingEmail"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '10 minutes'
      `;

      // Batch size kept modest (15) so a single invocation comfortably finishes
      // inside a serverless function's execution window even on a cold start.
      const lockedEmails = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "PendingEmail"
        WHERE status = 'PENDING'
        AND (scheduled_at IS NULL OR scheduled_at <= NOW())
        ORDER BY priority ASC, created_at ASC
        LIMIT 15
        FOR UPDATE SKIP LOCKED
      `;

      if (lockedEmails.length === 0) return summary;

      const emailIds = lockedEmails.map(e => e.id);
      summary.claimed = emailIds.length;

      await prisma.pendingEmail.updateMany({
        where: { id: { in: emailIds } },
        data: { status: 'PROCESSING' }
      });

      const emailsToProcess = await prisma.pendingEmail.findMany({
        where: { id: { in: emailIds } },
        include: {
          campaign: {
            include: {
              senderLinks: { include: { sender: { include: { domain: true } } } },
            },
          },
          lead: true,
          draft: true,
          preferredSender: { include: { domain: true } },
        }
      });

      for (const pending of emailsToProcess) {
        try {
          const campaign = pending.campaign;
          const lead = pending.lead;

          // Never send to an unsubscribed lead, regardless of how this
          // PendingEmail row was created (new campaign, added-later, or a
          // follow-up queued before the unsubscribe happened).
          if (lead.status === 'UNSUBSCRIBED') {
            await prisma.pendingEmail.delete({ where: { id: pending.id } });
            summary.skippedUnsubscribed++;
            continue;
          }

          if (!this.checkTimezone(campaign.timezone, campaign.activeStartHour, campaign.activeEndHour)) {
            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: new Date(Date.now() + 60 * 60 * 1000) }
            });
            summary.deferred++;
            continue;
          }

          if (!userLimitCache.has(pending.userId)) {
            userLimitCache.set(pending.userId, await this.isOverUserSendLimit(pending.userId));
          }
          if (userLimitCache.get(pending.userId)) {
            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: new Date(Date.now() + 60 * 60 * 1000) }
            });
            summary.deferred++;
            continue;
          }

          // Prefer the same sender the initial email in this thread used
          // (set on follow-ups by followUp.service.ts), so a reply thread
          // visually comes from one consistent address; otherwise round-robin.
          const activeSenders = campaign.senderLinks.map(l => l.sender).filter(s => s.status === 'active' && s.domain.status === 'active');
          if (activeSenders.length === 0) throw new Error('No active senders linked to this campaign');

          let selectedSender = pending.preferredSender && pending.preferredSender.status === 'active' && pending.preferredSender.domain.status === 'active'
            ? pending.preferredSender
            : activeSenders[campaign.lastDomainIndex % activeSenders.length];

          const today = new Date().toISOString().split('T')[0];
          const lastReset = new Date(selectedSender.lastSentReset).toISOString().split('T')[0];

          if (today !== lastReset) {
            selectedSender = await prisma.sender.update({
              where: { id: selectedSender.id },
              data: {
                sentCountToday: 0,
                lastSentReset: new Date(),
                warmupDay: { increment: 1 },
                dailyLimit: { increment: 5 }
              },
              include: { domain: true },
            });
          }

          // Atomically claim a send-slot for this SENDER (mailbox): with
          // multiple schedulers able to invoke separate concurrent
          // instances, a plain "read sentCountToday, compare, increment
          // later" pattern has a race where two instances can both pass the
          // check before either commits — overshooting the mailbox's daily
          // limit. This single conditional UPDATE claims the slot (or
          // fails) atomically regardless of how many instances are running.
          const claimResult = await prisma.$queryRaw<{ id: string }[]>`
            UPDATE "Sender"
            SET "sent_count_today" = "sent_count_today" + 1
            WHERE id = ${selectedSender.id} AND "sent_count_today" < "daily_limit"
            RETURNING id
          `;

          if (claimResult.length === 0) {
            const tomorrow = new Date();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(campaign.sendHourUTC || 9, 0, 0, 0);

            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: tomorrow }
            });
            summary.deferred++;
            logger.info({ sender: `${selectedSender.localPart}@${selectedSender.domain.domainName}` }, 'Sender mailbox limit reached. Deferring to next window.');
            continue;
          }

          const unsubscribeToken = await ensureUnsubscribeToken(lead.id, lead.unsubscribeToken);
          const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

          const { subject, body } = personalisationService.personalise(
            lead,
            pending.subject,
            pending.body,
            campaign.reference,
            selectedSender.displayName || campaign.senderName,
            unsubscribeUrl
          );

          const outboundRecord = await prisma.outboundEmail.create({
            data: {
              userId: pending.userId,
              domainId: selectedSender.domainId,
              leadId: pending.leadId,
              campaignId: pending.campaignId,
              draftId: pending.draftId,
              subject,
              body,
              status: 'PROCESSING'
            }
          });

          const result = await emailService.sendEmailNow(
            { ...selectedSender.domain, senderLocalPart: selectedSender.localPart },
            lead.email,
            subject,
            body.replace(/\n/g, '<br>'),
            body,
            outboundRecord.id,
            selectedSender.displayName || campaign.senderName,
            pending.inReplyTo,
            unsubscribeUrl
          );

          if (result.success) {
            await prisma.outboundEmail.update({
              where: { id: outboundRecord.id },
              data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() }
            });

            // Note: sentCountToday was already incremented atomically above
            // (the claim IS the increment) — do not increment it again here.

            // Rotation counter — indexes into the campaign's active SENDERS
            // list (not domains) since Phase 3's Domain/Sender restructure.
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { lastDomainIndex: { increment: 1 } }
            });

            await prisma.lead.update({
              where: { id: pending.leadId },
              data: { outreachStatus: 'SENT', status: 'CONTACTED' }
            });

            if (pending.draftId) {
              await prisma.draft.update({ where: { id: pending.draftId }, data: { sentCount: { increment: 1 } } });
            }

            await prisma.pendingEmail.delete({ where: { id: pending.id } });
            summary.sent++;
            logger.info({ leadId: pending.leadId, sender: `${selectedSender.localPart}@${selectedSender.domain.domainName}` }, 'Email Sent Successfully');

          } else {
            // Send failed after the slot was claimed — give the slot back so
            // a real failure doesn't silently eat into the mailbox's daily
            // capacity for no actual delivered email.
            await prisma.sender.update({
              where: { id: selectedSender.id },
              data: { sentCountToday: { decrement: 1 } }
            });
            throw new Error(result.error);
          }

        } catch (error: any) {
          summary.failed++;
          logger.error({ error: error.message, pendingId: pending.id }, 'Queue processing failed for email');
          await prisma.pendingEmail.update({
            where: { id: pending.id },
            data: { status: 'FAILED', error: error.message }
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Fatal Queue Processing Error');
    }
    return summary;
  }
}

export const emailQueueService = new EmailQueueService();
