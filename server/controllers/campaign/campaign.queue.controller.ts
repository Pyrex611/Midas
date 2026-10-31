import { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { personalisationService } from '../../services/personalisation.service';
import { emailQueueService } from '../../services/emailQueue.service';
import { CampaignRequest } from '../../middleware/campaignAccess.middleware';
import { logger } from '../../config/logger';

export async function reconcileCampaignQueue(campaignId: string, userId: string): Promise<{ queuedCount: number; message: string }> {
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
            const followUpDraft = campaign.drafts.find(d => d.useCase === 'followup' && d.stepNumber === step.stepNumber) || initialDraft;

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

export const pauseCampaign = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
    logger.info({ campaignId: id }, 'Campaign paused by operator');
    res.json(updated);
  } catch (error) { next(error); }
};

export const resumeCampaign = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    const reconciliation = await reconcileCampaignQueue(id, userId);
    logger.info({ campaignId: id, reconciliation }, 'Campaign resumed and reconciled');

    res.json({ ...updated, reconciliation });
  } catch (error) { next(error); }
};

export const reconcileQueueEndpoint = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const result = await reconcileCampaignQueue(id, userId);
    res.json(result);
  } catch (error) { next(error); }
};

/**
 * POST /api/campaigns/:id/repersonalize-queue
 * Refreshes all queued emails with fresh templates from the Campaign Copy Reserves,
 * wipes out stale/corrupt text, and personalizes using real lead attributes.
 */
export const repersonalizeCampaignQueue = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.id as string;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Pick active initial draft from reserves
    const activeInitialDrafts = campaign.drafts.filter(d => d.useCase === 'initial');
    const latestInitialDraft = activeInitialDrafts[0] || campaign.drafts[0];

    if (!latestInitialDraft) {
      return res.status(400).json({ error: 'No active email drafts found in this campaign. Create or generate an AI draft first.' });
    }

    const pendingList = await prisma.pendingEmail.findMany({
      where: { campaignId, status: 'PENDING' },
      include: { lead: true },
    });

    if (pendingList.length === 0) {
      return res.json({ success: true, updatedCount: 0, message: 'No pending emails in queue to refresh.' });
    }

    let updatedCount = 0;
    for (let i = 0; i < pendingList.length; i++) {
      const item = pendingList[i];
      // Rotate or assign across active initial draft reserves
      const targetDraft = activeInitialDrafts.length > 1
        ? activeInitialDrafts[i % activeInitialDrafts.length]
        : latestInitialDraft;

      // Re-personalize using the clean template from reserves
      const { subject, body } = personalisationService.personalise(
        item.lead,
        targetDraft.subject,
        targetDraft.body,
        campaign.reference,
        campaign.senderName
      );

      await prisma.pendingEmail.update({
        where: { id: item.id },
        data: {
          draftId: targetDraft.id,
          subject,
          body,
        },
      });
      updatedCount++;
    }

    logger.info({ campaignId, updatedCount }, 'Queue refreshed from copy reserves and re-personalized');
    res.json({
      success: true,
      updatedCount,
      message: `Refreshed ${updatedCount} queued email(s) with clean copy from active draft reserves.`,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to refresh queue');
    res.status(400).json({ error: error.message || 'Failed to refresh queue from reserves' });
  }
};

export const getCampaignHealth = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        senderLinks: { include: { sender: { include: { domain: true } } } },
        _count: { select: { leads: true, pendingEmails: true } },
      },
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const alerts: Array<{
      severity: 'error' | 'warning' | 'info';
      title: string;
      message: string;
      actionLabel?: string;
      actionType?: 'RESUME' | 'ACTIVATE' | 'ASSIGN_SENDERS' | 'NAVIGATE_DOMAINS' | 'DISPATCH_NOW' | 'ADJUST_HOURS' | 'RECONCILE_QUEUE' | 'REPERSONALIZE';
    }> = [];

    if (campaign.status === 'PAUSED') {
      alerts.push({
        severity: 'warning',
        title: 'Campaign Outreach is Paused',
        message: 'All automated sends and follow-up loops are currently halted.',
        actionLabel: 'Resume Outreach',
        actionType: 'RESUME',
      });
    }

    if (campaign.status === 'DRAFT') {
      alerts.push({
        severity: 'warning',
        title: 'Campaign in Draft Status',
        message: 'This campaign has not been launched yet.',
        actionLabel: 'Activate Campaign',
        actionType: 'ACTIVATE',
      });
    }

    const activeSenders = campaign.senderLinks
      .map(l => l.sender)
      .filter(s => s.status === 'active' && s.domain?.status === 'active');

    if (campaign.senderLinks.length === 0) {
      alerts.push({
        severity: 'error',
        title: 'No Sending Mailboxes Assigned',
        message: 'No mailboxes are attached to this campaign. The queue cannot dispatch emails without an assigned sender.',
        actionLabel: 'Assign Senders',
        actionType: 'ASSIGN_SENDERS',
      });
    } else if (activeSenders.length === 0) {
      alerts.push({
        severity: 'error',
        title: 'Attached Senders or Domains Are Inactive',
        message: 'The mailboxes attached to this campaign belong to domains that have failed connectivity tests or are paused.',
        actionLabel: 'Check Domains',
        actionType: 'NAVIGATE_DOMAINS',
      });
    }

    const allSendersMaxed = activeSenders.length > 0 && activeSenders.every(s => s.sentCountToday >= s.dailyLimit);
    if (allSendersMaxed) {
      alerts.push({
        severity: 'info',
        title: 'Daily Mailbox Capacity Reached',
        message: 'All assigned senders have reached their daily warmup quotas for today. Sends will resume at the next scheduled window.',
      });
    }

    const queuedCount = await prisma.pendingEmail.count({
      where: { campaignId: id, status: 'PENDING' },
    });

    const unqueuedLeadsCount = await prisma.lead.count({
      where: {
        campaignId: id,
        outreachStatus: 'PENDING',
        pendingEmails: { none: { campaignId: id } },
      },
    });

    if (unqueuedLeadsCount > 0 && campaign.status === 'ACTIVE') {
      alerts.push({
        severity: 'warning',
        title: `${unqueuedLeadsCount} Lead(s) Not Yet Staged in Queue`,
        message: 'Leads are attached to this campaign but are missing active queue records.',
        actionLabel: 'Reconcile & Queue Leads Now',
        actionType: 'RECONCILE_QUEUE',
      });
    }

    const rawPlaceholdersCount = await prisma.pendingEmail.count({
      where: {
        campaignId: id,
        status: 'PENDING',
        OR: [
          { body: { contains: 'Hello name' } },
          { body: { contains: 'regarding company' } },
          { body: { contains: 'senderName' } },
        ],
      },
    });

    if (rawPlaceholdersCount > 0) {
      alerts.push({
        severity: 'warning',
        title: `${rawPlaceholdersCount} Queued Email(s) Have Stale Placeholder Copy`,
        message: 'These emails were queued before copy reserves were updated. Click to refresh them with fresh drafts.',
        actionLabel: 'Refresh from Copy Reserves',
        actionType: 'REPERSONALIZE',
      });
    }

    const hasUnsentQueued = queuedCount > 0 && campaign.status === 'ACTIVE' && activeSenders.length > 0 && !allSendersMaxed;
    if (hasUnsentQueued) {
      alerts.push({
        severity: 'info',
        title: `${queuedCount} Email(s) Queued for Dispatch`,
        message: 'Emails are waiting in queue for the next scheduled cron tick.',
        actionLabel: 'Trigger Send Sweep Now',
        actionType: 'DISPATCH_NOW',
      });
    }

    res.json({
      status: campaign.status,
      queuedCount,
      leadsCount: campaign._count.leads,
      activeSendersCount: activeSenders.length,
      alerts,
    });
  } catch (error) { next(error); }
};

export const dispatchCampaignNow = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await reconcileCampaignQueue(id, userId);
    const summary = await emailQueueService.processQueue();
    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to dispatch campaign queue' });
  }
};