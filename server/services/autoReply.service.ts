// backend/src/services/autoReply.service.ts

import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService } from './ai.service';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { promptManager } from './promptManager.service';
import { mailboxService } from './mailbox.service';

export class AutoReplyService {
  async processReply(inboundEmailId: string) {
    try {
      const inbound = await prisma.outboundEmail.findUnique({
        where: { id: inboundEmailId },
        include: { lead: true, campaign: true },
      });

      if (!inbound || !inbound.campaign || !inbound.campaign.autoReplyEnabled) return;

      // 1. ANALYSIS: Fetch existing analysis or trigger fresh one
      const analysis = inbound.analysis ? JSON.parse(inbound.analysis) : await aiService.analyzeReply(inbound.body);
      const intent = (analysis.intent || '').toLowerCase();
      const sentiment = (analysis.sentiment || '').toLowerCase();

      // 2. SAFETY: Handle Out-of-Office (OOO)
      if (intent.includes('office') || intent.includes('vacation') || intent.includes('away')) {
        await prisma.lead.update({
          where: { id: inbound.leadId },
          data: { outreachStatus: 'FAILED', status: 'FOLLOW_UP' } // Marking FAILED prevents queue from picking it up
        });
        logger.info({ leadId: inbound.leadId }, 'Lead detected as OOO. Sequence paused.');
        return;
      }

      // 3. BUYING SIGNALS: The "Hot Jump"
      // If lead is positive AND asking for details/meeting, the AI should use the targetTool.
      const isHot = sentiment.includes('positive') && 
                   (intent.includes('info') || intent.includes('meeting') || intent.includes('call') || intent.includes('price'));

      if (isHot) {
					await prisma.lead.update({
							where: { id: inbound.leadId },
							data: { 
									outreachStatus: 'SENT', 
									status: 'CONTACTED',
									isSatisfied: true // 🔥 KILL-SWITCH: No more follow-ups!
							}
					});
					logger.info({ leadId: inbound.leadId }, 'Objective satisfied. Follow-ups disabled.');
			}
			// 4. MAILBOX SELECTION
      const selection = await mailboxService.selectMailboxForCampaign(inbound.campaignId, inbound.mailboxId);
      if (!selection) throw new Error("No mailbox for auto-reply");
      const decryptedMailbox = await mailboxService.getMailboxForSending(selection.mailbox.id);

      // 5. GENERATE ADAPTIVE RESPONSE
      // We pass the full history and the tool to the AI
      const conversationHistory = await prisma.outboundEmail.findMany({
        where: { leadId: inbound.leadId, campaignId: inbound.campaignId },
        orderBy: { sentAt: 'asc' },
        take: 5
      });

      const historyText = conversationHistory.map(m => 
        `${m.isIncoming ? 'Lead' : 'Me'}: ${m.body.substring(0, 100)}`
      ).join('\n');

      const { subject, body } = await aiService.generateDraft(
        'professional',
        'reply',
        inbound.campaign.context,
        inbound.campaign.reference,
        undefined,
        inbound.body,
        analysis.sentiment,
        undefined, // stepNumber
        inbound.campaign.objective,
        undefined, // microObjective
        inbound.campaign.targetTool, // 🔥 Tool passed to AI
        historyText                  // 🔥 History passed to AI
      );

      // 6. DELIVERY
      const result = await emailService.sendEmailNow(
        decryptedMailbox,
        inbound.lead.email,
        subject,
        body.replace(/\n/g, '<br>'),
        body,
        inbound.campaign.senderName,
        inbound.messageId
      );

      if (result.success) {
        // If Buying Signal was satisfied, stop further automated follow-ups
        if (isHot) {
           await prisma.lead.update({
             where: { id: inbound.leadId },
             data: { outreachStatus: 'SENT', status: 'CONTACTED' }
           });
        }

        await prisma.outboundEmail.create({
          data: {
            userId: inbound.userId,
            mailboxId: decryptedMailbox.id,
            leadId: inbound.leadId,
            campaignId: inbound.campaignId,
            subject,
            body,
            isIncoming: false,
            messageId: result.messageId,
            replyToId: inbound.id,
            sentAt: new Date(),
            status: 'SENT',
          },
        });
        logger.info({ leadId: inbound.leadId }, 'Strategic auto-reply delivered.');
      }
    } catch (error) {
      logger.error({ error, inboundEmailId }, 'Phase 5b: Adaptive auto-reply failed.');
    }
  }
}

export const autoReplyService = new AutoReplyService();