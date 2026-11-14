import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { personalisationService } from './personalisation.service';

export class FollowUpService {

  /**
   * Batched O(1)-roundtrip-per-campaign follow-up sequencer:
   * - Excludes UNSUBSCRIBED and BOUNCED leads.
   * - Eliminates N+1 per-lead queries by loading campaign OutboundEmails, PendingEmails,
   *   and follow-up Drafts once per campaign.
   * - Resolves `preferredSenderId` from the initial outbound email's domain senders so
   *   follow-ups continue from the exact same mailbox address.
   * - Queues at most ONE due follow-up step per lead per tick.
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
            outreachStatus: 'SENT',
            status: { notIn: ['UNSUBSCRIBED', 'BOUNCED'] },
          },
        });

        if (leads.length === 0) continue;

        const leadIds = leads.map(l => l.id);

        // Batch-load all outbound/inbound emails and pending queue items for this campaign's leads
        const [allEmails, allPending] = await Promise.all([
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

        // Index follow-up drafts by stepNumber
        const draftByStep = new Map<number, (typeof campaign.drafts)[number]>();
        for (const d of campaign.drafts) {
          if (d.stepNumber && !draftByStep.has(d.stepNumber)) {
            draftByStep.set(d.stepNumber, d);
          }
        }

        // Index active campaign senders by domainId for consistent thread sender matching
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

          // Stop follow-ups immediately if prospect has replied
          if (leadEmails.some(e => e.isIncoming)) continue;

          // If a pending email is already in-flight for this lead, wait for it
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

              const { subject, body } = personalisationService.personalise(
                lead,
                draft.subject,
                draft.body,
                campaign.reference,
                campaign.senderName
              );

              try {
                await prisma.pendingEmail.create({
                  data: {
                    userId: campaign.userId,
                    campaignId: campaign.id,
                    leadId: lead.id,
                    draftId: draft.id,
                    subject,
                    body,
                    inReplyTo: initialEmail.messageId,
                    domainId: initialEmail.domainId,
                    preferredSenderId,
                    status: 'PENDING',
                    priority: 2,
                    scheduledAt: now,
                  },
                });
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