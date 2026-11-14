import prisma from '../lib/prisma';
import { emailQueueService } from './emailQueue.service';
import { logger } from '../config/logger';

export async function reconcileCampaignQueue(
  campaignId: string,
  userId: string
): Promise<{ queuedCount: number; message: string }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      followUpSteps: { where: { enabled: true }, orderBy: { stepNumber: 'asc' } },
      leads: {
        include: {
          sentEmails: { orderBy: { sentAt: 'asc' } },
          pendingEmails: { where: { campaignId, status: { in: ['PENDING', 'PROCESSING'] } } },
        },
      },
    },
  });

  if (!campaign) throw new Error('Campaign not found');

  let initialDraft = campaign.drafts.find(d => d.useCase === 'initial') || campaign.drafts[0];
  if (!initialDraft) {
    initialDraft = await prisma.draft.create({
      data: {
        userId,
        campaignId,
        subject: `Quick question regarding {{company}}`,
        body: `Hi {{name}},\n\nI noticed your work at {{company}}. We help teams automate pipeline conversion without adding overhead.\n\nWorth exploring?\n\nBest,\n{{senderName}}`,
        tone: 'professional',
        useCase: 'initial',
      },
    });
  }

  let newlyQueued = 0;

  for (const lead of campaign.leads) {
    if (lead.status === 'UNSUBSCRIBED' || lead.status === 'BOUNCED') {
      await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId } });
      continue;
    }

    const hasReplied = lead.sentEmails.some(e => e.isIncoming);
    if (hasReplied) {
      await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id, campaignId } });
      continue;
    }

    const hasSentInitial = lead.sentEmails.some(e => !e.isIncoming);
    const hasActiveQueueItem = lead.pendingEmails.length > 0;

    if (!hasSentInitial && !hasActiveQueueItem) {
      await prisma.pendingEmail.create({
        data: {
          userId,
          campaignId,
          leadId: lead.id,
          draftId: initialDraft.id,
          subject: initialDraft.subject,
          body: initialDraft.body,
          status: 'PENDING',
          priority: 1,
          scheduledAt: new Date(),
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { outreachStatus: 'PENDING', campaignId },
      });

      newlyQueued++;
    }

    if (hasSentInitial && !hasActiveQueueItem && campaign.followUpSteps.length > 0) {
      const initialOutbound = lead.sentEmails.find(e => !e.isIncoming);
      if (initialOutbound) {
        const completedSteps = new Set<number>();
        lead.sentEmails.forEach(e => {
          if (e.draftId) {
            const d = campaign.drafts.find(draft => draft.id === e.draftId);
            if (d?.stepNumber) completedSteps.add(d.stepNumber);
          }
        });

        for (const step of campaign.followUpSteps) {
          if (completedSteps.has(step.stepNumber)) continue;

          const targetDate = new Date(initialOutbound.sentAt);
          targetDate.setDate(targetDate.getDate() + step.delayDays);

          if (new Date() >= targetDate) {
            const followUpDraft =
              campaign.drafts.find(d => d.useCase === 'followup' && d.stepNumber === step.stepNumber) ||
              initialDraft;

            await prisma.pendingEmail.create({
              data: {
                userId,
                campaignId,
                leadId: lead.id,
                draftId: followUpDraft.id,
                subject: followUpDraft.subject,
                body: followUpDraft.body,
                inReplyTo: initialOutbound.messageId,
                domainId: initialOutbound.domainId,
                status: 'PENDING',
                priority: 2,
                scheduledAt: new Date(),
              },
            });

            newlyQueued++;
            break;
          }
        }
      }
    }
  }

  if (newlyQueued > 0) {
    emailQueueService.processQueue().catch(err => {
      logger.error({ err }, 'Background queue sweep trigger failed on reconcile');
    });
  }

  return {
    queuedCount: newlyQueued,
    message: `Reconciliation complete: ${newlyQueued} lead(s) staged into active dispatch queue.`,
  };
}