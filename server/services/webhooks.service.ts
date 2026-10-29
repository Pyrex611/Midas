import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { sequenceAgentService } from './sequenceAgent.service';

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

    try {
      const email = await prisma.outboundEmail.findUnique({
        where: { id: outboundEmailId },
        include: { domain: true }
      });
      if (!email) return;

      const now = new Date(eventData.timestamp * 1000);

      if (eventType === 'opened' && !email.openedAt) {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { openedAt: now } });
      }
      else if (eventType === 'clicked' && !email.clickedAt) {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { clickedAt: now } });
      }
      else if (eventType === 'bounced' || eventType === 'failed') {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { bouncedAt: now, status: 'BOUNCED' } });
        await prisma.lead.update({ where: { id: email.leadId }, data: { outreachStatus: 'BOUNCED', status: 'BOUNCED' } });
        if (email.domainId) await this.updateDomainHealth(email.domainId, 'bounce');
      }
      else if (eventType === 'complained') {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { spamComplaint: true } });
        await prisma.lead.update({ where: { id: email.leadId }, data: { status: 'UNSUBSCRIBED', outreachStatus: 'UNSUBSCRIBED' } });
        if (email.domainId) await this.updateDomainHealth(email.domainId, 'complaint');
      }
    } catch (error) {
      logger.error({ error }, 'Deliverability webhook processing error');
    }
  }

  private async updateDomainHealth(domainId: string, type: 'bounce' | 'complaint') {
    const domain = await prisma.domain.findUnique({ where: { id: domainId }});
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
    }

    await prisma.domain.update({
      where: { id: domainId },
      data: {
        bounceRate: newBounceRate,
        complaintRate: newComplaintRate,
        status,
      }
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
          }
          return;
        }
      }

      let originalEmail = null;
      if (cleanInReplyTo) {
        originalEmail = await prisma.outboundEmail.findFirst({
          where: {
            isIncoming: false,
            OR: [
              { messageId: cleanInReplyTo },
              { messageId: `<${cleanInReplyTo}>` }
            ]
          },
          select: { id: true, leadId: true, campaignId: true, userId: true, domainId: true }
        });
      }

      // Scoped tenant fallback
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
              domainId: latestSent.domainId
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

      await prisma.lead.update({
        where: { id: originalEmail.leadId },
        data: {
          outreachStatus: 'REPLIED',
          status: 'REPLIED'
        }
      });

      // Route through Behavioral State-Graph Engine
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