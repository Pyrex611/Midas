import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService, InboundClassification } from './ai.service';
import { emailService } from './email.service';
import { personalisationService } from './personalisation.service';
import { senderService } from './sender.service';
import { artifactService } from './artifact.service';
import { planGuardService } from './billing/planGuard.service';
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

      // 1. AI Intent Classification using tenant's configured AI Studio provider
      const classification: InboundClassification = await aiService.classifyIntent(
        inboundBody,
        campaign.userId
      );
      logger.info(
        { leadId, intent: classification.intent, confidence: classification.confidence },
        '[STATE-GRAPH] Inbound reply classified'
      );

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

        // BRANCH B: OUT OF OFFICE (Freeze Sequence without permanent REPLIED stop)
        case 'OUT_OF_OFFICE': {
          let resumeDate = new Date();
          if (classification.extractedReturnDate) {
            const parsed = new Date(classification.extractedReturnDate);
            if (!isNaN(parsed.getTime()) && parsed > resumeDate) {
              resumeDate = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
            } else {
              resumeDate.setDate(resumeDate.getDate() + 7);
            }
          } else {
            resumeDate.setDate(resumeDate.getDate() + 7);
          }

          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'FOLLOW_UP', outreachStatus: 'OOO_FROZEN' },
          });

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

        // BRANCH C: OBJECTION HANDLING (Pricing, Timing, Competitor, Referral)
        case 'OBJECTION_PRICING':
        case 'OBJECTION_TIMING':
        case 'OBJECTION_COMPETITOR':
        case 'NOT_DECISION_MAKER': {
          await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId: campaign.id } });

          const objectionDraft = await aiService.generateObjectionResponse(
            campaign,
            lead,
            inboundBody,
            classification.intent,
            campaign.userId
          );

          if (campaign.autoReplyEnabled) {
            await this.dispatchAutonomousReply(lead, campaign, inboundEmail, objectionDraft);
          } else {
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

        // BRANCH D: CONVERSION (Demo / Info Interest) & General Replies
        case 'INTERESTED_DEMO':
        case 'INTERESTED_INFO':
        default: {
          await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId: campaign.id } });

          if (campaign.autoReplyEnabled) {
            const replyDraft = await aiService.generateDraft({
              tone: 'professional',
              useCase: 'reply',
              campaignContext: campaign.context,
              reference: campaign.reference,
              originalEmail: inboundBody,
              sentiment: classification.sentiment,
              userId: campaign.userId,
              campaignId: campaign.id,
            });
            await this.dispatchAutonomousReply(lead, campaign, inboundEmail, replyDraft);
          }
          break;
        }
      }
    } catch (err: any) {
      logger.error({ err: err?.message, leadId }, '[STATE-GRAPH] Inbound transition processing failed');
    }
  }

  private async stageManualFallbackDraft(
    leadId: string,
    campaign: any,
    draftData: { subject: string; body: string }
  ) {
    await prisma.draft.deleteMany({ where: { leadId, campaignId: campaign.id, isReplyDraft: true } });
    await prisma.draft.create({
      data: {
        userId: campaign.userId,
        leadId,
        campaignId: campaign.id,
        subject: draftData.subject,
        body: draftData.body,
        tone: 'professional',
        useCase: 'reply',
        isReplyDraft: true,
      },
    });
  }

  private async dispatchAutonomousReply(
    lead: any,
    campaign: any,
    inboundEmail: any,
    draftData: { subject: string; body: string }
  ) {
    if (!inboundEmail.domainId) {
      await this.stageManualFallbackDraft(lead.id, campaign, draftData);
      return;
    }

    if (await planGuardService.isOverMonthlyEmailLimit(campaign.userId)) {
      logger.warn({ userId: campaign.userId, leadId: lead.id }, '[STATE-GRAPH] Monthly email limit reached; staging reply draft instead of auto-sending');
      await this.stageManualFallbackDraft(lead.id, campaign, draftData);
      return;
    }

    const domain = await prisma.domain.findFirst({
      where: { id: inboundEmail.domainId, status: 'active' },
      include: { senders: { where: { status: 'active' } } },
    });

    if (!domain || domain.senders.length === 0) {
      await this.stageManualFallbackDraft(lead.id, campaign, draftData);
      return;
    }

    const chosen =
      (inboundEmail.senderId ? domain.senders.find((s) => s.id === inboundEmail.senderId) : undefined) ||
      domain.senders[0];

    const activeSender = await senderService.ensureSenderDailyReset(chosen.id);
    if (!activeSender) {
      await this.stageManualFallbackDraft(lead.id, campaign, draftData);
      return;
    }

    const claimResult = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Sender"
      SET "sent_count_today" = "sent_count_today" + 1,
          "last_dispatched_at" = NOW()
      WHERE id = ${activeSender.id} AND "sent_count_today" < "daily_limit"
      RETURNING id
    `;

    if (claimResult.length === 0) {
      logger.info({ senderId: activeSender.id }, '[STATE-GRAPH] Sender daily quota reached; staging reply draft');
      await this.stageManualFallbackDraft(lead.id, campaign, draftData);
      return;
    }

    const [userSettings, artifacts] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: campaign.userId } }),
      artifactService.getArtifactMapForUser(campaign.userId),
    ]);

    const unsubscribeToken = await ensureUnsubscribeToken(lead.id, lead.unsubscribeToken);
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

    const { subject, body } = personalisationService.personalise(
      lead,
      draftData.subject,
      draftData.body,
      campaign.reference,
      activeSender.displayName || campaign.senderName || null,
      unsubscribeUrl,
      {
        companyName: userSettings?.companyName,
        physicalAddress: userSettings?.physicalAddress,
        customOptOutText: userSettings?.customOptOutText,
        artifacts,
      }
    );

    const fromEmail = `${activeSender.localPart}@${domain.domainName}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId: campaign.userId,
        domainId: domain.id,
        senderId: activeSender.id,
        fromAddress: fromEmail,
        toAddress: lead.email,
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
      { ...domain, senderLocalPart: activeSender.localPart },
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      activeSender.displayName || campaign.senderName || null,
      inboundEmail.messageId,
      unsubscribeUrl,
      { leadId: lead.id, campaignId: campaign.id },
      {
        brandName: userSettings?.companyName,
        brandInitials: userSettings?.brandInitials,
        brandColorHex: userSettings?.brandColorHex,
        logoUrl: userSettings?.logoUrl,
        brandingEnabled: userSettings?.brandingEnabled,
      }
    );

    if (result.success) {
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
      });
      await planGuardService.recordEmailSent(campaign.userId, 1);
      await prisma.leadActivityEvent.create({
        data: {
          leadId: lead.id,
          campaignId: campaign.id,
          eventType: 'EMAIL_SENT',
          metadata: {
            outboundEmailId: outboundRecord.id,
            senderId: activeSender.id,
            sender: fromEmail,
            isAutonomousReply: true,
          },
        },
      });
      logger.info({ leadId: lead.id }, '[STATE-GRAPH] Autonomous reply dispatched');
    } else {
      await prisma.sender.update({
        where: { id: activeSender.id },
        data: { sentCountToday: { decrement: 1 } },
      });
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'FAILED', error: result.error },
      });
    }
  }
}

export const sequenceAgentService = new SequenceAgentService();