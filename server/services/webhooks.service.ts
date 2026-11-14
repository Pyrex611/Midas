import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
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

    return encodedToken === signature;
  }

  async processDeliverabilityEvent(payload: any) {
    const eventData = payload['event-data'];
    if (!eventData) return;

    const outboundEmailId = eventData['user-variables']?.outbound_email_id;
    if (!outboundEmailId) return;

    const eventType = eventData.event;
    const now = new Date(eventData.timestamp * 1000);

    try {
      // BRANCH A: TOWN CRIER NEWSLETTER BROADCAST DELIVERABILITY
      if (outboundEmailId.startsWith('tc_')) {
        const queueItemId = outboundEmailId.replace(/^tc_/, '');
        const queueItem = await prisma.newsletterQueueItem.findUnique({
          where: { id: queueItemId },
        });
        if (!queueItem) return;

        const domainId = eventData['user-variables']?.domain_id;
        let resolvedDomainId = domainId;

        if (!resolvedDomainId && eventData.domain) {
          const domain = await prisma.domain.findFirst({
            where: { domainName: eventData.domain },
            select: { id: true },
          });
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
          if (resolvedDomainId) {
            await this.updateDomainHealth(resolvedDomainId, 'bounce');
          }
          logger.warn({ queueItemId, recipientId: queueItem.recipientId }, 'Newsletter delivery bounced');
        } else if (eventType === 'complained') {
          await prisma.newsletterRecipient.update({
            where: { id: queueItem.recipientId },
            data: { status: 'UNSUBSCRIBED' },
          });
          if (resolvedDomainId) {
            await this.updateDomainHealth(resolvedDomainId, 'complaint');
          }
          logger.warn({ queueItemId, recipientId: queueItem.recipientId }, 'Newsletter spam complaint recorded');
        }
        return;
      }

      // BRANCH B: COLD CAMPAIGN OUTREACH DELIVERABILITY (OutboundEmail)
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
        if (email.domainId) await this.updateDomainHealth(email.domainId, 'bounce');
      } else if (eventType === 'complained') {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { spamComplaint: true } });
        await prisma.lead.update({ where: { id: email.leadId }, data: { status: 'UNSUBSCRIBED', outreachStatus: 'UNSUBSCRIBED' } });
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
        message: `Sending has been automatically halted. Bounce rate is ${(newBounceRate * 100).toFixed(1)}% (threshold 5%) or complaint rate is ${(newComplaintRate * 100).toFixed(2)}% (threshold 0.3%).`,
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
      data: {
        bounceRate: newBounceRate,
        complaintRate: newComplaintRate,
        status,
      },
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

      const cleanInReplyTo = rawInReplyTo ? rawInReplyTo.replace(/^<|>$/g, '').trim() : null;

      // Intercept domain connectivity receiving tests
      if (to) {
        const recipientAddress = (to.match(/<(.+)>/)?.[1] || to).trim().toLowerCase();
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
            logger.info({ domainId: domain.id, domainName: recipientDomainName }, 'Domain receiving test confirmed');

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
            OR: [
              { messageId: cleanInReplyTo },
              { messageId: `<${cleanInReplyTo}>` }
            ]
          },
          select: { id: true, leadId: true, campaignId: true, userId: true, domainId: true, draftId: true }
        });
      }

      if (!originalEmail && from && to) {
        const senderEmailMatch = from.match(/<(.+)>/)?.[1]?.trim().toLowerCase() || from.trim().toLowerCase();
        const recipientAddress = to.match(/<(.+)>/)?.[1]?.trim().toLowerCase() || to.trim().toLowerCase();
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
                take: 1
              }
            }
          });
          if (matchedLead && matchedLead.sentEmails.length > 0) {
            const latestSent = matchedLead.sentEmails[0];
            originalEmail = {
              id: latestSent.id,
              leadId: matchedLead.id,
              campaignId: latestSent.campaignId,
              userId: latestSent.userId,
              domainId: latestSent.domainId,
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
          leadId: originalEmail.leadId,
          campaignId: originalEmail.campaignId,
          subject,
          body,
          isIncoming: true,
          messageId: messageId ? messageId.replace(/^<|>$/g, '').trim() : null,
          inReplyTo: cleanInReplyTo,
          fromAddress: from,
          toAddress: to,
          replyToId: originalEmail.id,
          sentAt: new Date(payload.timestamp ? parseInt(payload.timestamp) * 1000 : Date.now()),
          status: 'DELIVERED',
        }
      });

      await prisma.outboundEmail.update({
        where: { id: originalEmail.id },
        data: { repliedAt: new Date() }
      });

      if (originalEmail.draftId) {
        await prisma.draft.update({
          where: { id: originalEmail.draftId },
          data: { replyCount: { increment: 1 } },
        }).catch(() => {});
      }

      const lead = await prisma.lead.update({
        where: { id: originalEmail.leadId },
        data: {
          outreachStatus: 'REPLIED',
          status: 'REPLIED'
        }
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
      }
    } catch (error) {
      logger.error({ error }, 'Failed to process inbound Mailgun email');
    }
  }
}

export const webhooksService = new WebhooksService();