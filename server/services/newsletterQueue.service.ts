import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { senderService } from './sender.service';
import { notificationService } from './notification.service';
import { env } from '../config/env';

export class NewsletterQueueService {
  private async ensureRecipientUnsubscribeToken(recipientId: string, currentToken: string | null): Promise<string> {
    if (currentToken && currentToken.trim()) return currentToken.trim();
    const token = crypto.randomBytes(16).toString('hex');
    await prisma.newsletterRecipient.update({
      where: { id: recipientId },
      data: { unsubscribeToken: token },
    });
    return token;
  }

  async processNewsletterQueue(): Promise<{ claimed: number; sent: number; deferred: number; failed: number }> {
    const summary = { claimed: 0, sent: 0, deferred: 0, failed: 0 };
    const batchSize = env.SEND_SWEEP_BATCH_SIZE || 5;
    const cooldownSeconds = env.SENDER_COOLDOWN_SECONDS || 20;

    try {
      await prisma.$executeRaw`
        UPDATE "NewsletterQueueItem"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND created_at < NOW() - INTERVAL '10 minutes'
      `;

      let itemIds: string[] = [];
      try {
        itemIds = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT q.id FROM "NewsletterQueueItem" q
            JOIN "NewsletterBroadcast" b ON q.broadcast_id = b.id
            WHERE q.status = 'PENDING'
            AND b.status IN ('QUEUED', 'SENDING')
            ORDER BY q.created_at ASC
            LIMIT ${batchSize}
            FOR UPDATE OF q SKIP LOCKED
          `;

          if (locked.length === 0) return [];
          const ids = locked.map(i => i.id);

          await tx.newsletterQueueItem.updateMany({
            where: { id: { in: ids } },
            data: { status: 'PROCESSING' },
          });

          return ids;
        }, { maxWait: 5000, timeout: 8000 });
      } catch (txErr: any) {
        logger.warn({ err: txErr?.message }, 'Newsletter queue claim transaction rolled back');
        return summary;
      }

      if (itemIds.length === 0) return summary;
      summary.claimed = itemIds.length;

      const itemsToProcess = await prisma.newsletterQueueItem.findMany({
        where: { id: { in: itemIds } },
        include: {
          broadcast: {
            include: {
              gong: {
                include: {
                  dedicatedSender: { include: { domain: true } },
                },
              },
            },
          },
        },
      });

      for (const item of itemsToProcess) {
        try {
          const recipient = await prisma.newsletterRecipient.findUnique({
            where: { id: item.recipientId },
          });

          if (!recipient || recipient.status !== 'SUBSCRIBED') {
            await prisma.newsletterQueueItem.update({
              where: { id: item.id },
              data: { status: 'FAILED', error: 'Recipient is unsubscribed or removed' },
            });
            summary.failed++;
            continue;
          }

          const userSettings = await prisma.userSettings.findUnique({
            where: { userId: item.userId },
            include: { dedicatedNewsletterSender: { include: { domain: true } } },
          });

          // Priority 1: Per-Gong dedicated sender
          // Priority 2: Account-wide dedicated newsletter sender
          // Priority 3: Active pool fallback with 50% fair-share cap
          let eligibleSender: any = null;

          const gongSender = item.broadcast.gong?.dedicatedSender;
          if (gongSender && gongSender.status === 'active' && gongSender.domain?.status === 'active') {
            eligibleSender = await senderService.ensureSenderDailyReset(gongSender.id);
          } else if (
            userSettings?.dedicatedNewsletterSender &&
            userSettings.dedicatedNewsletterSender.status === 'active' &&
            userSettings.dedicatedNewsletterSender.domain?.status === 'active'
          ) {
            eligibleSender = await senderService.ensureSenderDailyReset(userSettings.dedicatedNewsletterSender.id);
          } else {
            const rawSenders = await prisma.sender.findMany({
              where: {
                userId: item.userId,
                status: 'active',
                domain: { status: 'active' },
              },
              include: { domain: true },
            });

            if (rawSenders.length === 0) {
              await prisma.newsletterQueueItem.update({
                where: { id: item.id },
                data: { status: 'PENDING' },
              });
              summary.deferred++;
              continue;
            }

            const activeSenders = await Promise.all(
              rawSenders.map(s => senderService.ensureSenderDailyReset(s.id))
            );

            eligibleSender = activeSenders.find(s => {
              if (!s) return false;
              const fairShareCap = Math.max(5, Math.floor(s.dailyLimit * 0.5));
              const isUnderCap = s.sentCountToday < fairShareCap;
              const isCooledDown = !s.lastDispatchedAt || (Date.now() - new Date(s.lastDispatchedAt).getTime()) >= cooldownSeconds * 1000;
              return isUnderCap && isCooledDown;
            }) || activeSenders.find(s => s && s.sentCountToday < s.dailyLimit);
          }

          if (!eligibleSender) {
            await prisma.newsletterQueueItem.update({
              where: { id: item.id },
              data: { status: 'PENDING' },
            });
            summary.deferred++;
            continue;
          }

          // Respect per-sender cooldown even for dedicated senders
          if (eligibleSender.lastDispatchedAt) {
            const msSinceLast = Date.now() - new Date(eligibleSender.lastDispatchedAt).getTime();
            if (msSinceLast < cooldownSeconds * 1000) {
              await prisma.newsletterQueueItem.update({
                where: { id: item.id },
                data: { status: 'PENDING' },
              });
              summary.deferred++;
              continue;
            }
          }

          const claimResult = await prisma.$queryRaw<{ id: string }[]>`
            UPDATE "Sender"
            SET "sent_count_today" = "sent_count_today" + 1,
                "last_dispatched_at" = NOW()
            WHERE id = ${eligibleSender.id} AND "sent_count_today" < "daily_limit"
            RETURNING id
          `;

          if (claimResult.length === 0) {
            await prisma.newsletterQueueItem.update({
              where: { id: item.id },
              data: { status: 'PENDING' },
            });
            summary.deferred++;
            continue;
          }

          const token = await this.ensureRecipientUnsubscribeToken(recipient.id, recipient.unsubscribeToken);
          const appBaseUrl = process.env.APP_URL || 'https://midas-aem.vercel.app';
          const unsubUrl = `${appBaseUrl.replace(/\/$/, '')}/api/public/town-crier/recipients/unsubscribe/${token}`;

          const { subject, body } = personalisationService.personalise(
            recipient,
            item.broadcast.subject,
            item.broadcast.body,
            null,
            eligibleSender.displayName || userSettings?.companyName || 'The Team',
            unsubUrl,
            {
              companyName: userSettings?.companyName,
              physicalAddress: userSettings?.physicalAddress,
              customOptOutText: userSettings?.customOptOutText,
            }
          );

          const chosenTemplateStyle = item.broadcast.templateStyle || item.broadcast.gong?.templateStyle || 'card';

          const result = await emailService.sendEmailNow(
            { ...eligibleSender.domain, senderLocalPart: eligibleSender.localPart },
            recipient.email,
            subject,
            body.replace(/\n/g, '<br>'),
            body,
            `tc_${item.id}`,
            eligibleSender.displayName || userSettings?.companyName || null,
            undefined,
            unsubUrl,
            undefined,
            {
              brandName: userSettings?.companyName,
              brandInitials: userSettings?.brandInitials,
              brandColorHex: userSettings?.brandColorHex,
              logoUrl: userSettings?.logoUrl,
              brandingEnabled: userSettings?.brandingEnabled ?? true,
              templateStyle: chosenTemplateStyle,
            }
          );

          if (result.success) {
            await prisma.newsletterQueueItem.update({
              where: { id: item.id },
              data: { status: 'SENT' },
            });
            summary.sent++;

            const remaining = await prisma.newsletterQueueItem.count({
              where: { broadcastId: item.broadcastId, status: { in: ['PENDING', 'PROCESSING'] } },
            });
            if (remaining === 0) {
              await prisma.newsletterBroadcast.update({
                where: { id: item.broadcastId },
                data: { status: 'COMPLETED' },
              });

              notificationService.create({
                userId: item.userId,
                title: 'Newsletter Broadcast Completed',
                message: `"${item.broadcast.subject}" has finished sending to all queued subscribers.`,
                type: 'SUCCESS',
                link: '/town-crier',
              }).catch(() => {});
            } else {
              await prisma.newsletterBroadcast.update({
                where: { id: item.broadcastId },
                data: { status: 'SENDING' },
              });
            }
          } else {
            await prisma.sender.update({
              where: { id: eligibleSender.id },
              data: { sentCountToday: { decrement: 1 } },
            });
            await prisma.newsletterQueueItem.update({
              where: { id: item.id },
              data: { status: 'FAILED', error: result.error },
            });
            summary.failed++;
          }
        } catch (itemErr: any) {
          summary.failed++;
          await prisma.newsletterQueueItem.update({
            where: { id: item.id },
            data: { status: 'FAILED', error: itemErr.message },
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Fatal error during newsletter queue drain');
    }

    return summary;
  }

  async queueBroadcast(broadcastId: string, userId: string): Promise<{ queuedCount: number }> {
    const broadcast = await prisma.newsletterBroadcast.findFirst({
      where: { id: broadcastId, userId },
    });
    if (!broadcast) throw new Error('Broadcast not found');

    const cleanTag = broadcast.tagFilter?.trim() || null;

    const recipients = await prisma.newsletterRecipient.findMany({
      where: {
        userId,
        status: 'SUBSCRIBED',
        ...(broadcast.gongId ? { gongId: broadcast.gongId } : {}),
        ...(cleanTag ? { tags: { has: cleanTag } } : {}),
      },
      select: { id: true },
    });

    if (recipients.length === 0) {
      throw new Error(
        cleanTag
          ? `No active subscribed recipients found matching tag "${cleanTag}"`
          : 'No active subscribed recipients found for this broadcast'
      );
    }

    const CHUNK_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const batch = recipients.slice(i, i + CHUNK_SIZE).map(r => ({
        broadcastId: broadcast.id,
        recipientId: r.id,
        userId,
        status: 'PENDING',
      }));

      await prisma.newsletterQueueItem.createMany({
        data: batch,
      });
      inserted += batch.length;
    }

    await prisma.newsletterBroadcast.update({
      where: { id: broadcast.id },
      data: { status: 'QUEUED', queuedAt: new Date() },
    });

    this.processNewsletterQueue().catch(err => {
      logger.error({ err }, 'Opportunistic newsletter queue sweep failed');
    });

    return { queuedCount: inserted };
  }
}

export const newsletterQueueService = new NewsletterQueueService();