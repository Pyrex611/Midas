import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';

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
   * Processes a batch of due PendingEmail rows and sends them.
   *
   * Safe to call concurrently/overlapping: rows are claimed with
   * `SELECT ... FOR UPDATE SKIP LOCKED`, so it's fine to have multiple
   * schedulers (Vercel Cron, a GitHub Actions backup poller, and the
   * opportunistic "trigger on write" calls from controllers) hit this
   * at the same time without double-sending anything.
   *
   * Returns a small summary so cron callers/monitors can see throughput
   * without needing to inspect logs.
   */
  async processQueue(): Promise<{ claimed: number; sent: number; deferred: number; failed: number }> {
    const summary = { claimed: 0, sent: 0, deferred: 0, failed: 0 };
    try {
      await prisma.$executeRaw`
        UPDATE "PendingEmail"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '10 minutes'
      `;

      // Batch size kept modest (15) so a single invocation comfortably finishes
      // inside a serverless function's execution window even on a cold start.
      // On a free/Hobby Vercel plan where cron can only run once a day, this
      // is compensated for by frequent EXTERNAL triggers (see docs/SCHEDULING.md)
      // and by opportunistic calls fired from user-facing write endpoints.
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
          campaign: { include: { domainLinks: { include: { domain: true } } } },
          lead: true,
          draft: true
        }
      });

      for (const pending of emailsToProcess) {
        try {
          const campaign = pending.campaign;

          if (!this.checkTimezone(campaign.timezone, campaign.activeStartHour, campaign.activeEndHour)) {
            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: new Date(Date.now() + 60 * 60 * 1000) }
            });
            summary.deferred++;
            continue;
          }

          const activeDomains = campaign.domainLinks.map(l => l.domain).filter(d => d.status === 'active');
          if (activeDomains.length === 0) throw new Error('No active verified domains available for this campaign');

          let selectedDomain = activeDomains[campaign.lastDomainIndex % activeDomains.length];

          const today = new Date().toISOString().split('T')[0];
          const lastReset = new Date(selectedDomain.lastSentReset).toISOString().split('T')[0];

          if (today !== lastReset) {
            selectedDomain = await prisma.domain.update({
              where: { id: selectedDomain.id },
              data: {
                sentCountToday: 0,
                lastSentReset: new Date(),
                warmupDay: { increment: 1 },
                dailyLimit: { increment: 5 }
              }
            });
          }

          // Atomically claim a send-slot for this domain: with multiple
          // schedulers (Vercel Cron, GitHub Actions, Upstash QStash) able to
          // invoke separate concurrent instances, a plain
          // "read sentCountToday, compare, then increment later" pattern has
          // a race where two instances can both pass the check before either
          // commits — overshooting the domain's daily limit. This single
          // conditional UPDATE claims the slot (or fails) atomically at the
          // database level regardless of how many instances are running.
          const claimResult = await prisma.$queryRaw<{ id: string; sentCountToday: number }[]>`
            UPDATE "Domain"
            SET "sentCountToday" = "sentCountToday" + 1
            WHERE id = ${selectedDomain.id} AND "sentCountToday" < "dailyLimit"
            RETURNING id, "sentCountToday"
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
            logger.info({ domain: selectedDomain.domainName }, 'Domain limit reached. Deferring to next window.');
            continue;
          }

          const { subject, body } = personalisationService.personalise(
            pending.lead,
            pending.subject,
            pending.body,
            campaign.reference,
            campaign.senderName
          );

          const outboundRecord = await prisma.outboundEmail.create({
            data: {
              userId: pending.userId,
              domainId: selectedDomain.id,
              leadId: pending.leadId,
              campaignId: pending.campaignId,
              draftId: pending.draftId,
              subject,
              body,
              status: 'PROCESSING'
            }
          });

          const result = await emailService.sendEmailNow(
            selectedDomain,
            pending.lead.email,
            subject,
            body.replace(/\n/g, '<br>'),
            body,
            outboundRecord.id,
            campaign.senderName,
            pending.inReplyTo
          );

          if (result.success) {
            await prisma.outboundEmail.update({
              where: { id: outboundRecord.id },
              data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() }
            });

            // Note: sentCountToday was already incremented atomically above
            // (the claim IS the increment) — do not increment it again here.

            // Update round-robin rotation counter
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
            logger.info({ leadId: pending.leadId, domain: selectedDomain.domainName }, 'Email Sent Successfully');

          } else {
            // Send failed after the slot was claimed — give the slot back so
            // a real failure doesn't silently eat into the domain's daily
            // capacity for no actual delivered email.
            await prisma.domain.update({
              where: { id: selectedDomain.id },
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
