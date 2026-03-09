import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService } from './ai.service';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { promptManager } from './promptManager.service';

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
      if (!inbound) {
        logger.warn({ inboundEmailId }, 'Inbound email not found');
        return;
      }
      if (!inbound.campaign) {
        logger.debug({ inboundEmailId }, 'No campaign associated, skipping auto‑reply');
        return;
      }
      if (!inbound.campaign.autoReplyEnabled) {
        logger.debug({ campaignId: inbound.campaignId }, 'Auto‑reply disabled for campaign');
        return;
      }

      const lead = inbound.lead;
      const campaign = inbound.campaign;
      const userId = inbound.userId;

      // Fetch conversation history (last 5 emails)
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

      const params = {
        useCase: 'reply' as const,
        tone: 'professional',
        campaignContext: campaign.context,
        reference: campaign.reference,
        companyContext: null,
        originalEmail: inbound.body,
        originalSubject: inbound.subject,
        recipientName: lead.name,
        recipientCompany: lead.company || undefined,
        sentiment: analysis.sentiment,
        conversationHistory: historyFormatted,
      };
      const prompt = promptManager.buildPrompt(params);
      const system = 'You are an expert B2B sales closer. Output only valid JSON with "subject" and "body".';
      const raw = await aiService.complete(prompt, system);

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const draftData = JSON.parse(jsonMatch[0]);

      // Personalise the draft
      const { subject, body } = personalisationService.personalise(
        lead,
        draftData.subject,
        draftData.body,
        campaign.reference,
        campaign.senderName
      );

      // Send immediately (bypass queue)
      const result = await emailService.sendEmailNow(
        userId,
        lead.email,
        subject,
        body.replace(/\n/g, '<br>'),
        body,
        campaign.senderName,
        inbound.messageId
      );

      if (!result.success) throw new Error(result.error || 'Email sending failed');

      // Record the sent reply
      await prisma.outboundEmail.create({
        data: {
          userId,
          leadId: lead.id,
          campaignId: campaign.id,
          subject,
          body,
          isIncoming: false,
          messageId: result.messageId,
          replyToId: inbound.id,
          sentAt: new Date(),
          status: 'SENT',
        },
      });

      logger.info({ inboundEmailId, leadId: lead.id }, 'Auto‑reply sent immediately');
    } catch (error) {
      logger.error({ error, inboundEmailId }, 'Auto‑reply failed');
    }
  }
}

export const autoReplyService = new AutoReplyService();