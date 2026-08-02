import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';

export class EmailQueueService {
  
  private checkTimezone(timezone: string | null, startHour: number | null, endHour: number | null): boolean {
    if (!startHour || !endHour) return true; 
    const tz = timezone || 'UTC';
    try {
      const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
      const currentHour = parseInt(formatter.format(new Date()), 10);
      return currentHour >= startHour && currentHour < endHour;
    } catch (e) {
      return true; 
    }
  }

  async processQueue() {
    try {
      // 1. Stale Job Recovery
      await prisma.$executeRaw`
        UPDATE "PendingEmail"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '10 minutes'
      `;

      // 2. Concurrency-Safe Claiming
      const lockedEmails = await prisma.$queryRaw<{id: string}[]>`
        SELECT id FROM "PendingEmail"
        WHERE status = 'PENDING'
        AND (scheduled_at IS NULL OR scheduled_at <= NOW())
        ORDER BY priority ASC, created_at ASC
        LIMIT 15
        FOR UPDATE SKIP LOCKED
      `;

      if (lockedEmails.length === 0) return;

      const emailIds = lockedEmails.map(e => e.id);

      // Prisma automatically updates 'updatedAt' due to @updatedAt in schema
      await prisma.pendingEmail.updateMany({
        where: { id: { in: emailIds } },
        data: { status: 'PROCESSING' } // <-- Removed manual updatedAt
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

          // Timezone Guard
          if (!this.checkTimezone(campaign.timezone, campaign.activeStartHour, campaign.activeEndHour)) {
            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: new Date(Date.now() + 60 * 60 * 1000) }
            });
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

          // Domain Limit Guard: Safely defer to tomorrow instead of failing
          if (selectedDomain.sentCountToday >= selectedDomain.dailyLimit) {
            const tomorrow = new Date();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(campaign.sendHourUTC || 9, 0, 0, 0);

            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: tomorrow }
            });
            logger.info({ domain: selectedDomain.domainName }, 'Domain daily limit reached. Re-queued for tomorrow.');
            continue;
          }

          // Personalize & Send
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

            await prisma.domain.update({
              where: { id: selectedDomain.id },
              data: { sentCountToday: { increment: 1 } }
            });

            await prisma.lead.update({
              where: { id: pending.leadId },
              data: { outreachStatus: 'SENT', status: 'CONTACTED' }
            });

            if (pending.draftId) {
              await prisma.draft.update({ where: { id: pending.draftId }, data: { sentCount: { increment: 1 } } });
            }

            await prisma.pendingEmail.delete({ where: { id: pending.id } });
            logger.info({ leadId: pending.leadId, domain: selectedDomain.domainName }, 'Email Sent Successfully');

          } else {
            throw new Error(result.error);
          }

        } catch (error: any) {
          logger.error({ error: error.message, pendingId: pending.id }, 'Queue processing failed for email');
          await prisma.pendingEmail.update({
            where: { id: pending.id },
            data: { status: 'FAILED', error: error.message }
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Fatal Queue Error');
    }
  }
}

export const emailQueueService = new EmailQueueService();