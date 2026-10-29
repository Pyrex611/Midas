import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService, InboundClassification } from './ai.service';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from '../lib/unsubscribe';

export class SequenceAgentService {
  /**
   * Evaluates prospect behavioral telemetry and transitions lead through the state graph.
   */
  async processInboundTransition(
    leadId: string,
    campaignId: string,
    inboundEmailId: string,
    inboundBody: string
  ): Promise<void> {
    try {
      const [lead, campaign, inboundEmail] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.campaign.findUnique({ where: { id: campaignId } }),
        prisma.outboundEmail.findUnique({ where: { id: inboundEmailId } }),
      ]);

      if (!lead || !campaign || !inboundEmail) return;

      // 1. AI Intent Classification
      const classification: InboundClassification = await aiService.classifyIntent(inboundBody);
      logger.info(
        { leadId, intent: classification.intent, confidence: classification.confidence },
        '[STATE-GRAPH] Inbound reply classified'
      );

      // Record classification in OutboundEmail analysis
      await prisma.outboundEmail.update({
        where: { id: inboundEmailId },
        data: {
          sentiment: classification.sentiment,
          intent: classification.intent,
          analysis: JSON.stringify(classification),
        },
      });

      // 2. State-Graph Branching Logic
      switch (classification.intent) {
        // BRANCH A: UNSUBSCRIBE REQUEST
        case 'UNSUBSCRIBE_REQUEST': {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'UNSUBSCRIBED', outreachStatus: 'UNSUBSCRIBED' },
          });
          await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id } });
          logger.info({ leadId: lead.id }, '[STATE-GRAPH] Lead auto-unsubscribed via intent classification');
          break;
        }

        // BRANCH B: OUT OF OFFICE (Auto-Freeze Sequence)
        case 'OUT_OF_OFFICE': {
          let resumeDate = new Date();
          if (classification.extractedReturnDate) {
            const parsed = new Date(classification.extractedReturnDate);
            if (!isNaN(parsed.getTime()) && parsed > resumeDate) {
              resumeDate = new Date(parsed.getTime() + 24 * 60 * 60 * 1000); // Resume 24h after return
            } else {
              resumeDate.setDate(resumeDate.getDate() + 7); // Default 7 days
            }
          } else {
            resumeDate.setDate(resumeDate.getDate() + 7);
          }

          // Reschedule any pending follow-up emails to the resume date
          await prisma.pendingEmail.updateMany({
            where: { leadId: lead.id, campaignId: campaign.id },
            data: { scheduledAt: resumeDate },
          });

          await prisma.leadActivityEvent.create({
            data: {
              leadId: lead.id,
              campaignId: campaign.id,
              eventType: 'EMAIL_REPLIED',
              metadata: {
                intent: 'OUT_OF_OFFICE',
                frozenUntil: resumeDate.toISOString(),
              },
            },
          });

          logger.info({ leadId: lead.id, resumeDate }, '[STATE-GRAPH] Sequence cadence frozen for OOO lead');
          break;
        }

        // BRANCH C: OBJECTION HANDLING (Pricing, Timing, Competitor)
        case 'OBJECTION_PRICING':
        case 'OBJECTION_TIMING':
        case 'OBJECTION_COMPETITOR':
        case 'NOT_DECISION_MAKER': {
          // Cancel scheduled generic follow-up steps
          await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId: campaign.id } });

          // Synthesize tailored objection-handling copy
          const objectionDraft = await aiService.generateObjectionResponse(
            campaign,
            lead,
            inboundBody,
            classification.intent
          );

          if (campaign.autoReplyEnabled) {
            // Auto-dispatch response immediately if enabled
            await this.dispatchAutonomousReply(lead, campaign, inboundEmail, objectionDraft);
          } else {
            // Stage as reply draft in Unified Inbox for 1-click human approval
            await prisma.draft.deleteMany({ where: { leadId: lead.id, campaignId: campaign.id, isReplyDraft: true } });
            await prisma.draft.create({
              data: {
                userId: campaign.userId,
                leadId: lead.id,
                campaignId: campaign.id,
                subject: objectionDraft.subject,
                body: objectionDraft.body,
                tone: 'professional',
                useCase: 'reply',
                isReplyDraft: true,
              },
            });
            logger.info({ leadId: lead.id }, '[STATE-GRAPH] Objection response staged for human copilot review');
          }
          break;
        }

        // BRANCH D: CONVERSION (Demo / Info Interest)
        case 'INTERESTED_DEMO':
        case 'INTERESTED_INFO':
        default: {
          await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId: campaign.id } });

          if (campaign.autoReplyEnabled) {
            const replyDraft = await aiService.generateDraft(
              'professional',
              'reply',
              campaign.context,
              campaign.reference,
              undefined,
              inboundBody,
              classification.sentiment
            );
            await this.dispatchAutonomousReply(lead, campaign, inboundEmail, replyDraft);
          }
          break;
        }
      }
    } catch (err: any) {
      logger.error({ err: err?.message, leadId }, '[STATE-GRAPH] Inbound transition processing failed');
    }
  }

  private async dispatchAutonomousReply(
    lead: any,
    campaign: any,
    inboundEmail: any,
    draftData: { subject: string; body: string }
  ) {
    const domain = await prisma.domain.findFirst({
      where: { id: inboundEmail.domainId!, status: 'active' },
      include: { senders: { where: { status: 'active' }, take: 1 } },
    });

    if (!domain) return;
    const sender = domain.senders[0];
    const localPart = sender?.localPart || 'hello';

    const unsubscribeToken = await ensureUnsubscribeToken(lead.id, lead.unsubscribeToken);
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

    const { subject, body } = personalisationService.personalise(
      lead,
      draftData.subject,
      draftData.body,
      campaign.reference,
      campaign.senderName || sender?.displayName || null,
      unsubscribeUrl
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId: campaign.userId,
        domainId: domain.id,
        leadId: lead.id,
        campaignId: campaign.id,
        subject,
        body,
        isIncoming: false,
        status: 'PROCESSING',
        replyToId: inboundEmail.id,
      },
    });

    const result = await emailService.sendEmailNow(
      { ...domain, senderLocalPart: localPart },
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      campaign.senderName || sender?.displayName || null,
      inboundEmail.messageId,
      unsubscribeUrl,
      { leadId: lead.id, campaignId: campaign.id }
    );

    if (result.success) {
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
      });
      logger.info({ leadId: lead.id }, '[STATE-GRAPH] Autonomous reply dispatched');
    }
  }
}

export const sequenceAgentService = new SequenceAgentService();