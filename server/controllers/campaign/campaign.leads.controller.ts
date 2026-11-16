import { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { personalisationService } from '../../services/personalisation.service';
import { emailService } from '../../services/email.service';
import { senderService } from '../../services/sender.service';
import { artifactService } from '../../services/artifact.service';
import { planGuardService } from '../../services/billing/planGuard.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CampaignRequest } from '../../middleware/campaignAccess.middleware';
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from '../../lib/unsubscribe';

export const getLeadEmailThread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, campaignId },
    });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found in this campaign' });
    }

    const [campaign, emails, scheduled] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { senderLinks: { include: { sender: true } } },
      }),
      prisma.outboundEmail.findMany({
        where: { campaignId, leadId: lead.id },
        orderBy: { sentAt: 'asc' },
      }),
      prisma.pendingEmail.findMany({
        where: { campaignId, leadId: lead.id, status: { in: ['PENDING', 'PROCESSING'] } },
        include: { draft: true },
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

    const activeSender = campaign?.senderLinks.map(l => l.sender).find(s => s.status === 'active');
    const senderName = activeSender?.displayName || activeSender?.localPart || campaign?.senderName || 'The Team';

    const parsedEmails = emails.map(email => ({
      ...email,
      analysis: email.analysis ? (typeof email.analysis === 'string' ? JSON.parse(email.analysis) : email.analysis) : null,
    }));

    const resolvedScheduled = scheduled.map(item => {
      const { subject, body } = personalisationService.personalise(
        lead,
        item.subject,
        item.body,
        campaign?.reference,
        senderName
      );

      return {
        id: item.id,
        isScheduled: true,
        priority: item.priority,
        rawSubject: item.subject,
        rawBody: item.body,
        resolvedSubject: subject,
        resolvedBody: body,
        scheduledAt: item.scheduledAt,
        status: item.status,
      };
    });

    res.json({
      emails: parsedEmails,
      scheduled: resolvedScheduled,
    });
  } catch (error) {
    next(error);
  }
};

export const updateScheduledEmail = async (req: CampaignRequest, res: Response) => {
  try {
    const campaignId = req.params.campaignId as string;
    const pendingId = req.params.pendingId as string;
    const { subject, body } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const result = await prisma.pendingEmail.updateMany({
      where: { id: pendingId, campaignId },
      data: { subject: subject.trim(), body: body.trim() },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Scheduled email not found on this campaign' });
    }

    const updated = await prisma.pendingEmail.findUnique({ where: { id: pendingId } });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update scheduled email' });
  }
};

export const sendScheduledEmailNow = async (req: CampaignRequest, res: Response) => {
  try {
    const campaignId = req.params.campaignId as string;
    const pendingId = req.params.pendingId as string;
    const userId = req.user!.id;

    const pending = await prisma.pendingEmail.findFirst({
      where: { id: pendingId, campaignId },
      include: {
        lead: true,
        campaign: {
          include: {
            senderLinks: { include: { sender: { include: { domain: true } } } },
          },
        },
      },
    });

    if (!pending) return res.status(404).json({ error: 'Scheduled email not found on this campaign' });
    if (pending.lead.status === 'UNSUBSCRIBED') {
      await prisma.pendingEmail.delete({ where: { id: pending.id } });
      return res.status(400).json({ error: 'Lead has unsubscribed and cannot be emailed.' });
    }

    if (await planGuardService.isOverMonthlyEmailLimit(userId)) {
      return res.status(429).json({ error: 'Monthly workspace email limit reached. Upgrade your plan in Profile -> Billing.' });
    }

    const activeSenders = pending.campaign.senderLinks
      .map(l => l.sender)
      .filter(s => s.status === 'active' && s.domain?.status === 'active');

    if (activeSenders.length === 0) {
      return res.status(400).json({ error: 'No active sending mailboxes attached to this campaign.' });
    }

    let sender = activeSenders[0];
    sender = await senderService.ensureSenderDailyReset(sender.id);

    const claimResult = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Sender"
      SET "sent_count_today" = "sent_count_today" + 1,
          "last_dispatched_at" = NOW()
      WHERE id = ${sender.id} AND "sent_count_today" < "daily_limit"
      RETURNING id
    `;
    if (claimResult.length === 0) {
      return res.status(429).json({ error: 'Assigned sender mailbox has reached its daily quota limit.' });
    }

    const unsubscribeToken = await ensureUnsubscribeToken(pending.lead.id, pending.lead.unsubscribeToken);
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);
    const [userSettings, artifacts] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      artifactService.getArtifactMapForUser(userId),
    ]);

    const { subject, body } = personalisationService.personalise(
      pending.lead,
      pending.subject,
      pending.body,
      pending.campaign.reference,
      sender.displayName || pending.campaign.senderName,
      unsubscribeUrl,
      {
        companyName: userSettings?.companyName,
        physicalAddress: userSettings?.physicalAddress,
        customOptOutText: userSettings?.customOptOutText,
        artifacts,
      }
    );

    const fromEmail = `${sender.localPart}@${sender.domain.domainName}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: sender.domainId,
        senderId: sender.id,
        fromAddress: fromEmail,
        toAddress: pending.lead.email,
        leadId: pending.leadId,
        campaignId: pending.campaignId,
        draftId: pending.draftId,
        subject,
        body,
        status: 'PROCESSING',
      },
    });

    const result = await emailService.sendEmailNow(
      { ...sender.domain, senderLocalPart: sender.localPart },
      pending.lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      sender.displayName || pending.campaign.senderName,
      pending.inReplyTo,
      unsubscribeUrl,
      { leadId: pending.leadId, campaignId: pending.campaignId },
      {
        brandName: userSettings?.companyName,
        brandInitials: userSettings?.brandInitials,
        brandColorHex: userSettings?.brandColorHex,
        logoUrl: userSettings?.logoUrl,
        brandingEnabled: userSettings?.brandingEnabled,
      }
    );

    if (!result.success) {
      await prisma.sender.update({
        where: { id: sender.id },
        data: { sentCountToday: { decrement: 1 } },
      });
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'FAILED', error: result.error },
      });
      throw new Error(result.error || 'Failed to dispatch email via ESP');
    }

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });

    await planGuardService.recordEmailSent(userId, 1);

    await prisma.lead.update({
      where: { id: pending.leadId },
      data: { outreachStatus: 'SENT', status: 'CONTACTED' },
    });

    await prisma.leadActivityEvent.create({
      data: {
        leadId: pending.leadId,
        campaignId: pending.campaignId,
        eventType: 'EMAIL_SENT',
        metadata: {
          outboundEmailId: outboundRecord.id,
          senderId: sender.id,
          sender: fromEmail,
          isManualOverride: true,
        },
      },
    });

    if (pending.draftId) {
      await prisma.draft.update({ where: { id: pending.draftId }, data: { sentCount: { increment: 1 } } });
    }

    await prisma.pendingEmail.delete({ where: { id: pending.id } });

    res.json({ success: true, message: 'Scheduled email dispatched immediately.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to dispatch email' });
  }
};

export const previewLeadWithDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const draftId = req.params.draftId as string;

    const [lead, campaign, draft] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, campaignId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { senderLinks: { include: { sender: true } } },
      }),
      prisma.draft.findFirst({ where: { id: draftId, campaignId } }),
    ]);

    if (!lead || !campaign || !draft) {
      return res.status(404).json({ error: 'Lead, Campaign, or Draft not found on this campaign' });
    }

    const activeSender = campaign.senderLinks.map(l => l.sender).find(s => s.status === 'active');
    const senderName = activeSender?.displayName || activeSender?.localPart || campaign.senderName || 'The Team';

    const { subject, body } = personalisationService.personalise(
      lead,
      draft.subject,
      draft.body,
      campaign.reference,
      senderName
    );

    res.json({ leadId, campaignId, draftId, subject, body });
  } catch (error) {
    next(error);
  }
};

export const sendLeadEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const userId = req.user!.id;

    const [lead, campaign] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, campaignId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          senderLinks: { include: { sender: { include: { domain: true } } } },
        },
      }),
    ]);

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found on this campaign' });
    if (lead.status === 'UNSUBSCRIBED') return res.status(400).json({ error: 'This lead has unsubscribed' });

    if (await planGuardService.isOverMonthlyEmailLimit(userId)) {
      return res.status(429).json({ error: 'Monthly workspace email limit reached. Upgrade your plan in Profile -> Billing.' });
    }

    const draft = campaign.drafts[0];
    if (!draft) return res.status(400).json({ error: 'No active draft found' });

    const candidateSender = campaign.senderLinks.map(l => l.sender).find(s => s.status === 'active' && s.domain.status === 'active');
    if (!candidateSender) return res.status(400).json({ error: 'No active sender attached to this campaign' });

    const activeSender = await senderService.ensureSenderDailyReset(candidateSender.id);

    const claimResult = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Sender"
      SET "sent_count_today" = "sent_count_today" + 1,
          "last_dispatched_at" = NOW()
      WHERE id = ${activeSender.id} AND "sent_count_today" < "daily_limit"
      RETURNING id
    `;
    if (claimResult.length === 0) {
      return res.status(429).json({ error: 'Assigned sender mailbox has reached its daily quota limit.' });
    }

    const unsubscribeToken = await ensureUnsubscribeToken(lead.id, lead.unsubscribeToken);
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);
    const [userSettings, artifacts] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      artifactService.getArtifactMapForUser(userId),
    ]);

    const { subject, body } = personalisationService.personalise(
      lead,
      draft.subject,
      draft.body,
      campaign.reference,
      activeSender.displayName || campaign.senderName,
      unsubscribeUrl,
      {
        companyName: userSettings?.companyName,
        physicalAddress: userSettings?.physicalAddress,
        customOptOutText: userSettings?.customOptOutText,
        artifacts,
      }
    );

    const fromEmail = `${activeSender.localPart}@${activeSender.domain.domainName}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeSender.domainId,
        senderId: activeSender.id,
        fromAddress: fromEmail,
        toAddress: lead.email,
        leadId: lead.id,
        campaignId,
        draftId: draft.id,
        subject,
        body,
        status: 'PROCESSING',
      },
    });

    const result = await emailService.sendEmailNow(
      { ...activeSender.domain, senderLocalPart: activeSender.localPart },
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      activeSender.displayName || campaign.senderName,
      undefined,
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

    if (!result.success) {
      await prisma.sender.update({
        where: { id: activeSender.id },
        data: { sentCountToday: { decrement: 1 } },
      });
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'FAILED', error: result.error },
      });
      throw new Error(result.error);
    }

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });

    await planGuardService.recordEmailSent(userId, 1);

    await prisma.lead.update({
      where: { id: lead.id },
      data: { outreachStatus: 'SENT', status: 'CONTACTED' },
    });

    await prisma.leadActivityEvent.create({
      data: {
        leadId: lead.id,
        campaignId: campaign.id,
        eventType: 'EMAIL_SENT',
        metadata: {
          outboundEmailId: outboundRecord.id,
          senderId: activeSender.id,
          sender: fromEmail,
          isDirectCampaignSend: true,
        },
      },
    });

    res.json({ success: true, message: 'Email sent directly' });
  } catch (error) {
    next(error);
  }
};

export const sendReplyDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;
    const { subject, body } = req.body;
    const userId = req.user!.id;

    const [lead, campaign] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, campaignId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { senderLinks: { include: { sender: { include: { domain: true } } } } },
      }),
    ]);

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found on this campaign' });

    if (await planGuardService.isOverMonthlyEmailLimit(userId)) {
      return res.status(429).json({ error: 'Monthly workspace email limit reached. Upgrade your plan in Profile -> Billing.' });
    }

    const latestIncoming = await prisma.outboundEmail.findFirst({
      where: { leadId: lead.id, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });

    const activeSenders = campaign.senderLinks.map(l => l.sender).filter(s => s.status === 'active' && s.domain.status === 'active');
    if (activeSenders.length === 0) return res.status(400).json({ error: 'No active sender found' });
    const chosen = activeSenders.find(s => s.domainId === latestIncoming?.domainId) || activeSenders[0];
    const activeSender = await senderService.ensureSenderDailyReset(chosen.id);

    const claimResult = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Sender"
      SET "sent_count_today" = "sent_count_today" + 1,
          "last_dispatched_at" = NOW()
      WHERE id = ${activeSender.id} AND "sent_count_today" < "daily_limit"
      RETURNING id
    `;
    if (claimResult.length === 0) {
      return res.status(429).json({ error: 'Assigned sender mailbox has reached its daily quota limit.' });
    }

    const [userSettings, artifacts] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      artifactService.getArtifactMapForUser(userId),
    ]);

    const { subject: pSubject, body: pBody } = personalisationService.personalise(
      lead,
      subject,
      body,
      campaign.reference,
      activeSender.displayName || campaign.senderName,
      undefined,
      { artifacts }
    );

    const fromEmail = `${activeSender.localPart}@${activeSender.domain.domainName}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeSender.domainId,
        senderId: activeSender.id,
        fromAddress: fromEmail,
        toAddress: lead.email,
        leadId: lead.id,
        campaignId,
        subject: pSubject,
        body: pBody,
        isIncoming: false,
        status: 'PROCESSING',
        replyToId: latestIncoming?.id,
      },
    });

    const result = await emailService.sendEmailNow(
      { ...activeSender.domain, senderLocalPart: activeSender.localPart },
      lead.email,
      pSubject,
      pBody.replace(/\n/g, '<br>'),
      pBody,
      outboundRecord.id,
      activeSender.displayName || campaign.senderName,
      latestIncoming?.messageId,
      undefined,
      { leadId: lead.id, campaignId: campaign.id },
      {
        brandName: userSettings?.companyName,
        brandInitials: userSettings?.brandInitials,
        brandColorHex: userSettings?.brandColorHex,
        logoUrl: userSettings?.logoUrl,
        brandingEnabled: userSettings?.brandingEnabled,
      }
    );

    if (!result.success) {
      await prisma.sender.update({
        where: { id: activeSender.id },
        data: { sentCountToday: { decrement: 1 } },
      });
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'FAILED', error: result.error },
      });
      throw new Error(result.error);
    }

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });

    await planGuardService.recordEmailSent(userId, 1);

    await prisma.leadActivityEvent.create({
      data: {
        leadId: lead.id,
        campaignId: campaign.id,
        eventType: 'EMAIL_SENT',
        metadata: {
          outboundEmailId: outboundRecord.id,
          senderId: activeSender.id,
          sender: fromEmail,
          isReplyDraft: true,
        },
      },
    });

    await prisma.draft.deleteMany({ where: { leadId: lead.id, campaignId, isReplyDraft: true } });

    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    next(error);
  }
};