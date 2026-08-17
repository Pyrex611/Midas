import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService } from './ai.service';
import { autoReplyService } from './autoReply.service';

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
        await prisma.lead.update({ where: { id: email.leadId }, data: { outreachStatus: 'BOUNCED' } });
        if (email.domainId) await this.updateDomainHealth(email.domainId, 'bounce');
      }
      else if (eventType === 'complained') {
        await prisma.outboundEmail.update({ where: { id: outboundEmailId }, data: { spamComplaint: true } });
        await prisma.lead.update({ where: { id: email.leadId }, data: { status: 'UNSUBSCRIBED' } });
        if (email.domainId) await this.updateDomainHealth(email.domainId, 'complaint');
      }

    } catch (error) {
      logger.error({ error }, 'Deliverability webhook processing error');
    }
  }

  private async updateDomainHealth(domainId: string, type: 'bounce' | 'complaint') {
    const domain = await prisma.domain.findUnique({ where: { id: domainId }});
    if (!domain) return;

    const totalSent = (domain.sentCountToday || 0) + (domain.warmupDay * 20) || 1;
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
        status
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

      // Fallback: match most recently contacted lead by email address
      if (!originalEmail && from) {
        const senderEmailMatch = from.match(/<(.+)>/)?.[1] || from.trim().toLowerCase();
        const matchedLead = await prisma.lead.findFirst({
          where: { email: senderEmailMatch },
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

      if (!originalEmail) {
        logger.debug({ rawInReplyTo, from }, 'Could not map inbound email to outbound campaign');
        return;
      }

      let analysisPayload = null;
      try {
        const analysis = await aiService.analyzeReply(body);
        analysisPayload = JSON.stringify(analysis);
      } catch (err) {
        logger.error({ err }, 'AI Analysis failed for inbound email');
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
          analysis: analysisPayload
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

      // Cancel any remaining queued follow-up steps for this lead
      await prisma.pendingEmail.deleteMany({
        where: { leadId: originalEmail.leadId }
      });

      logger.info({ leadId: originalEmail.leadId }, 'Inbound reply processed, follow-ups cancelled.');

      if (originalEmail.campaignId) {
        const campaign = await prisma.campaign.findUnique({ where: { id: originalEmail.campaignId } });
        if (campaign?.autoReplyEnabled) {
          autoReplyService.processReply(inboundEmail.id).catch(err => {
            logger.error({ err }, 'Auto-reply engine failed');
          });
        }
      }

    } catch (error) {
      logger.error({ error }, 'Failed to process inbound Mailgun email');
    }
  }
}

export const webhooksService = new WebhooksService();