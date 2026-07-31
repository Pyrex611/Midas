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
      logger.error({ error }, 'Webhook processing error');
    }
  }

  private async updateDomainHealth(domainId: string, type: 'bounce' | 'complaint') {
    const domain = await prisma.domain.findUnique({ where: { id: domainId }});
    if (!domain) return;

    const newBounceRate = type === 'bounce' ? domain.bounceRate + 0.01 : domain.bounceRate;
    const newComplaintRate = type === 'complaint' ? domain.complaintRate + 0.005 : domain.complaintRate;

    let status = domain.status;
    
    if (newBounceRate >= 0.03 || newComplaintRate >= 0.001) {
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

  // --- Phase 5: Inbound Reply Handling ---
  async processInboundEmail(payload: any) {
    try {
      const messageId = payload['Message-Id'];
      const inReplyTo = payload['In-Reply-To'];
      const from = payload.sender || payload.from;
      const to = payload.recipient || payload.to;
      const subject = payload.subject;
      
      // Mailgun extracts just the user's reply, stripping out the massive quoted history!
      const body = payload['stripped-text'] || payload['body-plain'];

      if (!inReplyTo) {
        logger.debug({ messageId }, 'Inbound email has no In-Reply-To header. Skipping.');
        return;
      }

      // Find original outbound email
      const originalEmail = await prisma.outboundEmail.findFirst({
        where: { messageId: inReplyTo, isIncoming: false },
        select: { id: true, leadId: true, campaignId: true, userId: true, domainId: true }
      });

      if (!originalEmail) {
        logger.debug({ inReplyTo }, 'Could not map inbound email to an outbound campaign.');
        return;
      }

      // Check if we already processed this messageId (Mailgun retry protection)
      const existing = await prisma.outboundEmail.findFirst({ where: { messageId } });
      if (existing) return;

      // 1. Run AI Sentiment & Intent Analysis
      let analysisPayload = null;
      try {
        const analysis = await aiService.analyzeReply(body);
        analysisPayload = JSON.stringify(analysis);
      } catch (err) {
        logger.error({ err }, 'AI Analysis failed for inbound email');
      }

      // 2. Save the inbound message
      const inboundEmail = await prisma.outboundEmail.create({
        data: {
          userId: originalEmail.userId,
          domainId: originalEmail.domainId,
          leadId: originalEmail.leadId,
          campaignId: originalEmail.campaignId,
          subject,
          body,
          isIncoming: true,
          messageId,
          inReplyTo,
          fromAddress: from,
          toAddress: to,
          replyToId: originalEmail.id,
          sentAt: new Date(payload.timestamp ? parseInt(payload.timestamp) * 1000 : Date.now()),
          status: 'DELIVERED',
          analysis: analysisPayload
        }
      });

      // 3. Mark the Outbound as replied & Lead as REPLIED
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

      logger.info({ leadId: originalEmail.leadId }, 'Successfully processed and mapped inbound reply.');

      // 4. Trigger Auto-Reply Engine (if enabled on Campaign)
      const campaign = await prisma.campaign.findUnique({ where: { id: originalEmail.campaignId! }});
      if (campaign?.autoReplyEnabled) {
        autoReplyService.processReply(inboundEmail.id).catch(err => {
          logger.error({ err }, 'Auto-reply engine failed');
        });
      }

    } catch (error) {
      logger.error({ error }, 'Failed to process inbound Mailgun email');
    }
  }
}

export const webhooksService = new WebhooksService();