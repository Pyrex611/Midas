import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export class FollowUpService {
  /**
   * Batched O(1)-roundtrip-per-campaign follow-up sequencer:
   * - Excludes UNSUBSCRIBED, BOUNCED, and terminal REPLIED leads.
   * - Supports OOO_FROZEN leads: pauses scheduling until `frozenUntil` expires,
   *   ignoring prior OOO inbound messages while stopping permanently on any real reply.
   * - Stores raw draft template (`subject`, `body`) into `PendingEmail` so
   *   `emailQueueService` resolves Spintax, {{artifact:slug}} links, sender
   *   display names, and RFC-8058 unsubscribe footers accurately at dispatch time.
   */
  async checkFollowUps(): Promise<{ queued: number; campaignsScanned: number }> {
    let queued = 0;
    let campaignsScanned = 0;

    try {
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: 'ACTIVE',
          followUpSteps: { some: { enabled: true } },
        },
        include: {
          followUpSteps: {
            where: { enabled: true },
            orderBy: { stepNumber: 'asc' },
          },
          senderLinks: {
            include: { sender: true },
          },
          drafts: {
            where: { useCase: 'followup', isActive: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      campaignsScanned = campaigns.length;

      for (const campaign of campaigns) {
        const leads = await prisma.lead.findMany({
          where: {
            campaignId: campaign.id,
            outreachStatus: { in: ['SENT', 'OOO_FROZEN'] },
            status: { notIn: ['UNSUBSCRIBED', 'BOUNCED', 'REPLIED'] },
          },
        });

        if (leads.length === 0) continue;

        const leadIds = leads.map(l => l.id);

        const [allEmails, allPending, oooEvents] = await Promise.all([
          prisma.outboundEmail.findMany({
            where: {
              campaignId: campaign.id,
              leadId: { in: leadIds },
            },
            include: { draft: { select: { stepNumber: true } } },
            orderBy: { sentAt: 'asc' },
          }),
          prisma.pendingEmail.findMany({
            where: {
              campaignId: campaign.id,
              leadId: { in: leadIds },
            },
            include: { draft: { select: { stepNumber: true } } },
          }),
          prisma.leadActivityEvent.findMany({
            where: {
              campaignId: campaign.id,
              leadId: { in: leadIds },
              eventType: 'EMAIL_REPLIED',
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        const emailsByLead = new Map<string, typeof allEmails>();
        for (const email of allEmails) {
          const list = emailsByLead.get(email.leadId) || [];
          list.push(email);
          emailsByLead.set(email.leadId, list);
        }

        const pendingByLead = new Map<string, typeof allPending>();
        for (const p of allPending) {
          const list = pendingByLead.get(p.leadId) || [];
          list.push(p);
          pendingByLead.set(p.leadId, list);
        }

        const latestOooUntilByLead = new Map<string, Date>();
        for (const ev of oooEvents) {
          if (latestOooUntilByLead.has(ev.leadId)) continue;
          const meta = ev.metadata as any;
          if (meta?.intent === 'OUT_OF_OFFICE' && meta?.frozenUntil) {
            const parsed = new Date(meta.frozenUntil);
            if (!isNaN(parsed.getTime())) {
              latestOooUntilByLead.set(ev.leadId, parsed);
            }
          }
        }

        const draftByStep = new Map<number, (typeof campaign.drafts)[number]>();
        for (const d of campaign.drafts) {
          if (d.stepNumber && !draftByStep.has(d.stepNumber)) {
            draftByStep.set(d.stepNumber, d);
          }
        }

        const senderByDomain = new Map<string, string>();
        for (const link of campaign.senderLinks) {
          if (link.sender.status === 'active' && !senderByDomain.has(link.sender.domainId)) {
            senderByDomain.set(link.sender.domainId, link.sender.id);
          }
        }

        const now = new Date();

        for (const lead of leads) {
          const leadEmails = emailsByLead.get(lead.id) || [];
          const leadPending = pendingByLead.get(lead.id) || [];

          // Stop follow-ups permanently if prospect sent any real non-OOO reply
          const hasHumanReply = leadEmails.some(e => e.isIncoming && e.intent !== 'OUT_OF_OFFICE');
          if (hasHumanReply) continue;

          // Respect active OOO freeze window until prospect returns
          if (lead.outreachStatus === 'OOO_FROZEN') {
            const frozenUntil = latestOooUntilByLead.get(lead.id);
            if (frozenUntil && now < frozenUntil) {
              continue;
            }
          }

          if (leadPending.some(p => p.status === 'PENDING' || p.status === 'PROCESSING')) continue;

          const initialEmail = leadEmails.find(e => !e.isIncoming);
          if (!initialEmail) continue;

          const completedStepNumbers = new Set<number>();
          for (const e of leadEmails) {
            if (e.id !== initialEmail.id && e.draft?.stepNumber) {
              completedStepNumbers.add(e.draft.stepNumber);
            }
          }
          for (const p of leadPending) {
            if (p.draft?.stepNumber) {
              completedStepNumbers.add(p.draft.stepNumber);
            }
          }

          for (const step of campaign.followUpSteps) {
            if (completedStepNumbers.has(step.stepNumber)) continue;

            const targetDate = new Date(initialEmail.sentAt);
            targetDate.setDate(targetDate.getDate() + step.delayDays);

            if (now >= targetDate) {
              const draft = draftByStep.get(step.stepNumber);
              if (!draft) {
                logger.warn({ leadId: lead.id, campaignId: campaign.id, stepNumber: step.stepNumber }, 'No follow-up draft available');
                break;
              }

              const preferredSenderId = initialEmail.domainId
                ? senderByDomain.get(initialEmail.domainId) || null
                : null;

              try {
                await prisma.pendingEmail.create({
                  data: {
                    userId: campaign.userId,
                    campaignId: campaign.id,
                    leadId: lead.id,
                    draftId: draft.id,
                    subject: draft.subject,
                    body: draft.body,
                    inReplyTo: initialEmail.messageId,
                    domainId: initialEmail.domainId,
                    preferredSenderId,
                    status: 'PENDING',
                    priority: 2,
                    scheduledAt: now,
                  },
                });

                if (lead.outreachStatus === 'OOO_FROZEN') {
                  await prisma.lead.update({
                    where: { id: lead.id },
                    data: { outreachStatus: 'SENT', status: 'FOLLOW_UP' },
                  });
                }

                queued++;
                logger.info({ leadId: lead.id, campaignId: campaign.id, step: step.stepNumber }, 'Follow-up queued in PendingEmail');
              } catch (queueErr: any) {
                logger.error({ error: queueErr?.message, leadId: lead.id, campaignId: campaign.id }, 'Failed to queue follow-up');
              }

              // Queue strictly one step per lead per tick to preserve sequential cadence
              break;
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Follow-up sequencer execution failed');
    }

    return { queued, campaignsScanned };
  }
}

export const followUpService = new FollowUpService();