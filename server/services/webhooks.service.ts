import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { tryDecrypt } from '../lib/encryption';
import { sequenceAgentService } from './sequenceAgent.service';
import { notificationService } from './notification.service';
import { webhookDispatchService } from './webhookDispatch.service';

export class WebhooksService {
  verifyMailgunSignature(timestamp: string, token: string, signature: string): boolean {
    const webhookKey = process.env.MAILGUN_WEBHOOK_KEY;
    if (!webhookKey) return false;

    const encodedToken = crypto
      .createHmac('sha256', webhookKey)
      .update(timestamp.concat(token))
      .digest('hex');

    const a = Buffer.from(encodedToken, 'utf8');
    const b = Buffer.from(signature || '', 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  verifyCustomInboundToken(domainId: string, providedToken?: string): boolean {
    if (!providedToken) return false;
    const secret = process.env.ENCRYPTION_KEY || process.env.CRON_SECRET || '';
    if (!secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(`inbound:${domainId}`).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(providedToken.trim(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * Normalizes Resend Svix webhooks:
   * - `email.received`: fetches full text/html & headers via GET /emails/receiving/:id
   * - `email.opened` / `email.clicked` / `email.bounced` / `email.complained`: maps into processDeliverabilityEvent
   */
  async processResendWebhook(payload: any) {
    const eventType: string = payload?.type || '';
    const data = payload?.data || {};

    if (eventType === 'email.received') {
      const toList: string[] = Array.isArray(data.to) ? data.to : data.to ? [String(data.to)] : [];
      const firstTo = toList[0] || '';
      const recipientAddr = (firstTo.match(/<(.+)>/)?.[1] || firstTo).trim().toLowerCase();
      const recipientDomainName = recipientAddr.split('@')[1];

      let fetchedBodyText = '';
      let fetchedBodyHtml = '';
      let inReplyTo: string | null = null;
      let references: string | null = null;
      let messageId: string | null = data.message_id || null;

      if (recipientDomainName && data.email_id) {
        const domain = await prisma.domain.findFirst({
          where: { domainName: recipientDomainName, espProvider: 'resend' },
          select: { mailgunApiKeyEncrypted: true },
        });
        const resendKey = tryDecrypt(domain?.mailgunApiKeyEncrypted);

        if (resendKey) {
          try {
            const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(data.email_id)}`, {
              headers: { Authorization: `Bearer ${resendKey}` },
              signal: AbortSignal.timeout(8_000),
            });
            if (res.ok) {
              const fullEmail: any = await res.json();
              fetchedBodyText = fullEmail.text || '';
              fetchedBodyHtml = fullEmail.html || '';
              const hdrs = fullEmail.headers || {};
              inReplyTo = hdrs['in-reply-to'] || hdrs['In-Reply-To'] || null;
              references = hdrs['references'] || hdrs['References'] || null;
              messageId = fullEmail.message_id || messageId;
            }
          } catch (err: any) {
            logger.warn({ err: err?.message, emailId: data.email_id }, '[RESEND-INBOUND] Failed to fetch receiving body');
          }
        }
      }

      await this.processInboundEmail({
        'Message-Id': messageId,
        'In-Reply-To': inReplyTo,
        References: references,
        from: data.from,
        to: firstTo,
        subject: data.subject || 'Re: Outreach',
        'stripped-text': fetchedBodyText,
        'stripped-html': fetchedBodyHtml,
        timestamp: Math.floor(new Date(payload.created_at || Date.now()).getTime() / 1000),
      });
      return;
    }

    const tags = data.tags;
    let outboundEmailId: string | undefined;
    if (tags && typeof tags === 'object' && !Array.isArray(tags)) {
      outboundEmailId = tags.outbound_email_id;
    } else if (Array.isArray(tags)) {
      outboundEmailId = tags.find((t: any) => t.name === 'outbound_email_id')?.value;
    }

    if (!outboundEmailId) return;

    const eventMap: Record<string, string> = {
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.delivery_delayed': 'failed',
    };

    const mapped = eventMap[eventType];
    if (!mapped) return;

    await this.processDeliverabilityEvent({
      'event-data': {
        event: mapped,
        timestamp: Math.floor(new Date(payload.created_at || Date.now()).getTime() / 1000),
        'user-variables': { outbound_email_id: outboundEmailId },
        'delivery-status': { message: data.bounce?.message || data.reason || eventType },
      },
    });
  }

  async processDeliverabilityEvent(payload: any) {
    const eventData = payload['event-data'];
    if (!eventData) return;

    const outboundEmailId = eventData['user-variables']?.outbound_email_id;
    if (!outboundEmailId) return;

    const eventType = eventData.event;
    const now = new Date((eventData.timestamp || Math.floor(Date.now() / 1000)) * 1000);

    try {
      if (outboundEmailId.startsWith('tc_')) {
        const queueItemId = outboundEmailId.replace(/^tc_/, '');
        const queueItem = await prisma.newsletterQueueItem.findUnique({ where: { id: queueItemId } });
        if (!queueItem) return;

        let resolvedDomainId = eventData['user-variables']?.domain_id;
        if (!resolvedDomainId && eventData.domain) {
          const domain = await prisma.domain.findFirst({ where: { domainName: eventData.domain }, select: { id: true } });
          resolvedDomainId = domain?.id;
        }

        if (eventType === 'bounced' || eventType === 'failed') {
          await prisma.newsletterQueueItem.update({
            where: { id: queueItemId },
            data: { status: 'FAILED', error: eventData['delivery-status']?.message || 'Bounced' },
          });
          await prisma.newsletterRecipient.update({
            where: { id: queueItem.recipientId },
            data: { status: 'BOUNCED' },
          });
          await prisma.newsletterQueueItem.deleteMany({
            where: { recipientId: queueItem.recipientId, status: 'PENDING' },
          });
          if (resolvedDomainId) await this.updateDomainHealth(resolvedDomainId, 'bounce');
        } else if (eventType === 'complained') {
          await prisma.newsletterRecipient.update({
            where: { id: queueItem.recipientId },
            data: { status: 'UNSUBSCRIBED' },
          });
          await prisma.newsletterQueueItem.deleteMany({
            where: { recipientId: queueItem.recipientId, status: 'PENDING' },
          });
          if (resolvedDomainId) await this.updateDomainHealth(resolvedDomainId, 'complaint');
        }
        return;
      }

      const email = await prisma.outboundEmail.findUnique({
        where: { id: outboundEmailId },
        include: { domain: true },
      });
      if (!email) return;

      if (eventType === 'opened' && !email.openedAt) {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { openedAt: now } });
      } else if (eventType === 'clicked' && !email.clickedAt) {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { clickedAt: now } });
      } else if (eventType === 'bounced' || eventType === 'failed') {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { bouncedAt: now, status: 'BOUNCED' } });
        await prisma.lead.update({ where: { id: email.leadId }, data: { outreachStatus: 'BOUNCED', status: 'BOUNCED' } });
        // Drop any remaining queued follow-ups so we never dispatch to a known-bounced address
        await prisma.pendingEmail.deleteMany({ where: { leadId: email.leadId } });
        if (email.domainId) await this.updateDomainHealth(email.domainId, 'bounce');
      } else if (eventType === 'complained') {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { spamComplaint: true } });
        await prisma.lead.update({ where: { id: email.leadId }, data: { status: 'UNSUBSCRIBED', outreachStatus: 'UNSUBSCRIBED' } });
        await prisma.pendingEmail.deleteMany({ where: { leadId: email.leadId } });
        if (email.domainId) await this.updateDomainHealth(email.domainId, 'complaint');
      }
    } catch (error) {
      logger.error({ error }, 'Deliverability webhook processing error');
    }
  }

  private async updateDomainHealth(domainId: string, type: 'bounce' | 'complaint') {
    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) return;

    const totalSent = await prisma.outboundEmail.count({
      where: { domainId, status: { in: ['SENT', 'BOUNCED'] } },
    }) || 1;

    const newBounceRate = type === 'bounce' ? (domain.bounceRate * totalSent + 1) / (totalSent + 1) : domain.bounceRate;
    const newComplaintRate = type === 'complaint' ? (domain.complaintRate * totalSent + 1) / (totalSent + 1) : domain.complaintRate;

    let status = domain.status;
    if (newBounceRate >= 0.05 || newComplaintRate >= 0.003) {
      status = 'paused_health_risk';
      logger.warn({ domainId, newBounceRate, newComplaintRate }, 'AUTO-PAUSE KILLSWITCH ACTIVATED FOR DOMAIN');

      notificationService.create({
        userId: domain.userId,
        title: `Deliverability Circuit Breaker Tripped: ${domain.domainName}`,
        message: `Sending halted. Bounce rate ${(newBounceRate * 100).toFixed(1)}% or complaint rate ${(newComplaintRate * 100).toFixed(2)}%.`,
        type: 'URGENT',
        link: '/domains',
        metadata: { domainId, newBounceRate, newComplaintRate },
      }).catch(() => {});

      webhookDispatchService.dispatch({
        userId: domain.userId,
        event: 'deliverability.circuit_tripped',
        payload: {
          domainId: domain.id,
          domainName: domain.domainName,
          bounceRate: newBounceRate,
          complaintRate: newComplaintRate,
          status,
          trippedAt: new Date().toISOString(),
        },
      }).catch(() => {});
    }

    await prisma.domain.update({
      where: { id: domainId },
      data: { bounceRate: newBounceRate, complaintRate: newComplaintRate, status },
    });
  }

  async processInboundEmail(payload: any) {
    try {
      const messageId = payload['Message-Id'] || payload['message-id'];
      const rawInReplyTo = payload['In-Reply-To'] || payload['in-reply-to'] || payload['References'] || payload['references'];
      const from = payload.sender || payload.from;
      const to = payload.recipient || payload.to;
      const subject = payload.subject || 'Re: Outreach';
      const body = payload['stripped-text'] || payload['body-plain'] || payload['stripped-html'] || '';

      const cleanInReplyTo = rawInReplyTo ? String(rawInReplyTo).replace(/^<|>$/g, '').trim() : null;

      if (to) {
        const recipientAddress = (String(to).match(/<(.+)>/)?.[1] || String(to)).trim().toLowerCase();
        if (recipientAddress.startsWith('connectivity@')) {
          const recipientDomainName = recipientAddress.split('@')[1];
          const domain = await prisma.domain.findFirst({
            where: { domainName: recipientDomainName, receivingTestCode: { not: null } },
          });
          if (domain && domain.receivingTestCode && body.includes(domain.receivingTestCode)) {
            await prisma.domain.update({
              where: { id: domain.id },
              data: { receivingConfirmedAt: new Date() },
            });
            notificationService.create({
              userId: domain.userId,
              title: `Domain Receiving Confirmed: ${domain.domainName}`,
              message: `Inbound route verified successfully. Prospects can now reply directly to your mailboxes.`,
              type: 'SUCCESS',
              link: '/domains',
            }).catch(() => {});
          }
          return;
        }
      }

      let originalEmail: any = null;
      if (cleanInReplyTo) {
        originalEmail = await prisma.outboundEmail.findFirst({
          where: {
            isIncoming: false,
            OR: [{ messageId: cleanInReplyTo }, { messageId: `<${cleanInReplyTo}>` }],
          },
          select: { id: true, leadId: true, campaignId: true, userId: true, domainId: true, senderId: true, draftId: true },
        });
      }

      if (!originalEmail && from && to) {
        const senderEmailMatch = String(from).match(/<(.+)>/)?.[1]?.trim().toLowerCase() || String(from).trim().toLowerCase();
        const recipientAddress = String(to).match(/<(.+)>/)?.[1]?.trim().toLowerCase() || String(to).trim().toLowerCase();
        const recipientDomainName = recipientAddress.split('@')[1];

        const owningDomain = recipientDomainName
          ? await prisma.domain.findFirst({
              where: { domainName: recipientDomainName },
              select: { userId: true },
            })
          : null;

        if (owningDomain) {
          const matchedLead = await prisma.lead.findFirst({
            where: { email: senderEmailMatch, userId: owningDomain.userId },
            include: {
              sentEmails: {
                where: { isIncoming: false },
                orderBy: { sentAt: 'desc' },
                take: 1,
              },
            },
          });
          if (matchedLead && matchedLead.sentEmails.length > 0) {
            const latestSent = matchedLead.sentEmails[0];
            originalEmail = {
              id: latestSent.id,
              leadId: matchedLead.id,
              campaignId: latestSent.campaignId,
              userId: latestSent.userId,
              domainId: latestSent.domainId,
              senderId: latestSent.senderId,
              draftId: latestSent.draftId,
            };
          }
        }
      }

      if (!originalEmail) {
        logger.debug({ rawInReplyTo, from }, 'Could not map inbound email to outbound campaign');
        return;
      }

      const inboundEmail = await prisma.outboundEmail.create({
        data: {
          userId: originalEmail.userId,
          domainId: originalEmail.domainId,
          senderId: originalEmail.senderId || null,
          leadId: originalEmail.leadId,
          campaignId: originalEmail.campaignId,
          subject,
          body,
          isIncoming: true,
          messageId: messageId ? String(messageId).replace(/^<|>$/g, '').trim() : null,
          inReplyTo: cleanInReplyTo,
          fromAddress: from,
          toAddress: to,
          replyToId: originalEmail.id,
          sentAt: new Date(payload.timestamp ? parseInt(payload.timestamp, 10) * 1000 : Date.now()),
          status: 'DELIVERED',
        },
      });

      await prisma.outboundEmail.update({
        where: { id: originalEmail.id },
        data: { repliedAt: new Date() },
      });

      if (originalEmail.draftId) {
        await prisma.draft.update({
          where: { id: originalEmail.draftId },
          data: { replyCount: { increment: 1 } },
        }).catch(() => {});
      }

      const lead = await prisma.lead.update({
        where: { id: originalEmail.leadId },
        data: { outreachStatus: 'REPLIED', status: 'REPLIED' },
      });

      await prisma.leadActivityEvent.create({
        data: {
          leadId: lead.id,
          campaignId: originalEmail.campaignId || null,
          eventType: 'EMAIL_REPLIED',
          metadata: {
            inboundEmailId: inboundEmail.id,
            subject,
            fromAddress: from,
          },
        },
      }).catch(() => {});

      notificationService.create({
        userId: originalEmail.userId,
        title: `New Reply from ${lead.name}`,
        message: `${subject}: "${body.slice(0, 90).replace(/\s+/g, ' ')}..."`,
        type: 'INBOUND_REPLY',
        link: `/inbox`,
        metadata: { leadId: lead.id, emailId: inboundEmail.id },
      }).catch(() => {});

      webhookDispatchService.dispatch({
        userId: originalEmail.userId,
        event: 'lead.replied',
        payload: {
          leadId: lead.id,
          leadEmail: lead.email,
          leadName: lead.name,
          campaignId: originalEmail.campaignId || null,
          emailId: inboundEmail.id,
          subject,
          snippet: body.slice(0, 240),
          repliedAt: inboundEmail.sentAt.toISOString(),
        },
      }).catch(() => {});

      if (originalEmail.campaignId) {
        sequenceAgentService.processInboundTransition(
          originalEmail.leadId,
          originalEmail.campaignId,
          inboundEmail.id,
          body
        ).catch(err => {
          logger.error({ err: err?.message }, '[STATE-GRAPH] Transition execution failure');
        });
      } else {
        await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id } });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to process inbound email');
    }
  }
}

export const webhooksService = new WebhooksService();