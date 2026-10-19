import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService } from './ai.service';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';

export class AutoReplyService {
  async processReply(inboundEmailId: string) {
    try {
      const inbound = await prisma.outboundEmail.findUnique({
        where: { id: inboundEmailId },
        include: {
          lead: true,
          campaign: true,
        },
      });

      if (!inbound || !inbound.campaign || !inbound.campaign.autoReplyEnabled) {
        return;
      }

      const lead = inbound.lead;
      const campaign = inbound.campaign;
      const userId = inbound.userId;

      const conversationHistory = await prisma.outboundEmail.findMany({
        where: { leadId: lead.id, campaignId: campaign.id },
        orderBy: { sentAt: 'asc' },
        take: 5,
      });

      const historyFormatted = conversationHistory
        .map(msg => {
          const sender = msg.isIncoming ? 'Lead' : 'You';
          return `[${sender} - ${new Date(msg.sentAt).toLocaleString()}]\nSubject: ${msg.subject}\nBody: ${msg.body}\n`;
        })
        .join('\n');

      let analysis = inbound.analysis ? JSON.parse(inbound.analysis) : null;
      if (!analysis) {
        analysis = await aiService.analyzeReply(inbound.body);
      }

      const draftData = await aiService.generateDraft(
        'professional',
        'reply',
        campaign.context,
        campaign.reference,
        undefined,
        inbound.body,
        analysis.sentiment
      );

      const { subject, body } = personalisationService.personalise(
        lead,
        draftData.subject,
        draftData.body,
        campaign.reference,
        campaign.senderName
      );

      const domain = await prisma.domain.findFirst({
        where: { id: inbound.domainId!, status: 'active' },
      });

      if (!domain) {
        logger.error({ inboundEmailId }, 'Auto-reply domain not found or inactive');
        return;
      }

      const outboundRecord = await prisma.outboundEmail.create({
        data: {
          userId,
          domainId: domain.id,
          leadId: lead.id,
          campaignId: campaign.id,
          subject,
          body,
          isIncoming: false,
          status: 'PROCESSING',
          replyToId: inbound.id,
        },
      });

      const result = await emailService.sendEmailNow(
        domain,
        lead.email,
        subject,
        body.replace(/\n/g, '<br>'),
        body,
        outboundRecord.id,
        campaign.senderName,
        inbound.messageId
      );

      if (!result.success) throw new Error(result.error);

      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'SENT', messageId: result.messageId },
      });

      logger.info({ inboundEmailId, leadId: lead.id }, 'Auto-reply sent successfully');
    } catch (error: any) {
      logger.error({ error: error.message, inboundEmailId }, 'Auto-reply failed');
    }
  }
}

export const autoReplyService = new AutoReplyService();