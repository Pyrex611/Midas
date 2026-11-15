import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { senderService } from './sender.service';
import { artifactService } from './artifact.service';
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from '../lib/unsubscribe';
import { env } from '../config/env';

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
    } catch {
      return true;
    }
  }

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

  async processQueue(): Promise<{ claimed: number; sent: number; deferred: number; failed: number; skippedUnsubscribed: number }> {
    const summary = { claimed: 0, sent: 0, deferred: 0, failed: 0, skippedUnsubscribed: 0 };
    const userLimitCache = new Map<string, boolean>();
    const userSettingsCache = new Map<string, any>();
    const artifactMapCache = new Map<string, Record<string, { url: string; type: string; title: string }>>();

    const batchSize = env.SEND_SWEEP_BATCH_SIZE || 5;
    const cooldownSeconds = env.SENDER_COOLDOWN_SECONDS || 20;

    try {
      await prisma.$executeRaw`
        UPDATE "PendingEmail"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '10 minutes'
      `;

      let emailIds: string[] = [];
      try {
        emailIds = await prisma.$transaction(async (tx) => {
          const lockedEmails = await tx.$queryRaw<{ id: string }[]>`
            SELECT p.id FROM "PendingEmail" p
            JOIN "Campaign" c ON p.campaign_id = c.id
            WHERE p.status = 'PENDING'
            AND c.status = 'ACTIVE'
            AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
            ORDER BY p.priority ASC, p.created_at ASC
            LIMIT ${batchSize}
            FOR UPDATE OF p SKIP LOCKED
          `;

          if (lockedEmails.length === 0) return [];
          const ids = lockedEmails.map(e => e.id);

          await tx.pendingEmail.updateMany({
            where: { id: { in: ids } },
            data: { status: 'PROCESSING' },
          });

          return ids;
        }, { maxWait: 5000, timeout: 8000 });
      } catch (txErr: any) {
        logger.warn({ err: txErr?.message }, 'Queue claim transaction rolled back or timed out');
        return summary;
      }

      if (emailIds.length === 0) return summary;
      summary.claimed = emailIds.length;

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
        },
      });

      for (const pending of emailsToProcess) {
        try {
          const campaign = pending.campaign;
          const lead = pending.lead;

          if (campaign.status !== 'ACTIVE') {
            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING' },
            });
            summary.deferred++;
            continue;
          }

          if (lead.status === 'UNSUBSCRIBED') {
            await prisma.pendingEmail.delete({ where: { id: pending.id } });
            summary.skippedUnsubscribed++;
            continue;
          }

          if (!this.checkTimezone(campaign.timezone, campaign.activeStartHour, campaign.activeEndHour)) {
            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: new Date(Date.now() + 60 * 60 * 1000) },
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
              data: { status: 'PENDING', scheduledAt: new Date(Date.now() + 60 * 60 * 1000) },
            });
            summary.deferred++;
            continue;
          }

          const activeSenders = campaign.senderLinks
            .map(l => l.sender)
            .filter(s => s.status === 'active' && s.domain.status === 'active');

          if (activeSenders.length === 0) throw new Error('No active senders linked to this campaign');

          let selectedSender =
            pending.preferredSender &&
            pending.preferredSender.status === 'active' &&
            pending.preferredSender.domain.status === 'active'
              ? pending.preferredSender
              : activeSenders[campaign.lastDomainIndex % activeSenders.length];

          selectedSender = await senderService.ensureSenderDailyReset(selectedSender.id);

          if (selectedSender.lastDispatchedAt) {
            const msSinceLast = Date.now() - new Date(selectedSender.lastDispatchedAt).getTime();
            if (msSinceLast < cooldownSeconds * 1000) {
              await prisma.pendingEmail.update({
                where: { id: pending.id },
                data: { status: 'PENDING', scheduledAt: new Date(Date.now() + 25_000) },
              });
              summary.deferred++;
              continue;
            }
          }

          const claimResult = await prisma.$queryRaw<{ id: string }[]>`
            UPDATE "Sender"
            SET "sent_count_today" = "sent_count_today" + 1,
                "last_dispatched_at" = NOW()
            WHERE id = ${selectedSender.id} AND "sent_count_today" < "daily_limit"
            RETURNING id
          `;

          if (claimResult.length === 0) {
            const tomorrow = new Date();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(campaign.sendHourUTC || 9, 0, 0, 0);

            await prisma.pendingEmail.update({
              where: { id: pending.id },
              data: { status: 'PENDING', scheduledAt: tomorrow },
            });
            summary.deferred++;
            continue;
          }

          if (!userSettingsCache.has(pending.userId)) {
            userSettingsCache.set(
              pending.userId,
              await prisma.userSettings.findUnique({ where: { userId: pending.userId } })
            );
          }
          if (!artifactMapCache.has(pending.userId)) {
            artifactMapCache.set(
              pending.userId,
              await artifactService.getArtifactMapForUser(pending.userId)
            );
          }

          const userSettings = userSettingsCache.get(pending.userId);
          const artifacts = artifactMapCache.get(pending.userId);

          const unsubscribeToken = await ensureUnsubscribeToken(lead.id, lead.unsubscribeToken);
          const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

          const { subject, body } = personalisationService.personalise(
            lead,
            pending.subject,
            pending.body,
            campaign.reference,
            selectedSender.displayName || campaign.senderName,
            unsubscribeUrl,
            {
              companyName: userSettings?.companyName,
              physicalAddress: userSettings?.physicalAddress,
              customOptOutText: userSettings?.customOptOutText,
              artifacts,
            }
          );

          const fromEmail = `${selectedSender.localPart}@${selectedSender.domain.domainName}`;

          const outboundRecord = await prisma.outboundEmail.create({
            data: {
              userId: pending.userId,
              domainId: selectedSender.domainId,
              senderId: selectedSender.id,
              fromAddress: fromEmail,
              toAddress: lead.email,
              leadId: pending.leadId,
              campaignId: pending.campaignId,
              draftId: pending.draftId,
              subject,
              body,
              status: 'PROCESSING',
            },
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
            unsubscribeUrl,
            { leadId: pending.leadId, campaignId: pending.campaignId },
            {
              brandName: userSettings?.companyName,
              brandInitials: userSettings?.brandInitials,
              brandColorHex: userSettings?.brandColorHex,
              logoUrl: userSettings?.logoUrl,
              brandingEnabled: userSettings?.brandingEnabled,
            }
          );

          if (result.success) {
            await prisma.outboundEmail.update({
              where: { id: outboundRecord.id },
              data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
            });

            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { lastDomainIndex: { increment: 1 } },
            });

            await prisma.lead.update({
              where: { id: pending.leadId },
              data: { outreachStatus: 'SENT', status: 'CONTACTED' },
            });

            await prisma.leadActivityEvent.create({
              data: {
                leadId: pending.leadId,
                campaignId: pending.campaignId,
                eventType: 'EMAIL_SENT',
                metadata: {
                  outboundEmailId: outboundRecord.id,
                  senderId: selectedSender.id,
                  sender: fromEmail,
                },
              },
            });

            if (pending.draftId) {
              await prisma.draft.update({ where: { id: pending.draftId }, data: { sentCount: { increment: 1 } } });
            }

            await prisma.pendingEmail.delete({ where: { id: pending.id } });
            summary.sent++;
            logger.info({ leadId: pending.leadId, sender: fromEmail }, 'Email Sent Successfully');
          } else {
            await prisma.sender.update({
              where: { id: selectedSender.id },
              data: { sentCountToday: { decrement: 1 } },
            });
            throw new Error(result.error);
          }
        } catch (error: any) {
          summary.failed++;
          logger.error({ error: error.message, pendingId: pending.id }, 'Queue processing failed for email');
          await prisma.pendingEmail.update({
            where: { id: pending.id },
            data: { status: 'FAILED', error: error.message },
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