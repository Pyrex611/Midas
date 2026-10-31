import { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { personalisationService } from '../../services/personalisation.service';
import { emailService } from '../../services/email.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CampaignRequest } from '../../middleware/campaignAccess.middleware';
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from '../../lib/unsubscribe';

export const getLeadEmailThread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const leadId = req.params.leadId as string;

    const [lead, campaign, emails, scheduled] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.outboundEmail.findMany({
        where: { campaignId, leadId },
        orderBy: { sentAt: 'asc' },
      }),
      prisma.pendingEmail.findMany({
        where: { campaignId, leadId, status: { in: ['PENDING', 'PROCESSING'] } },
        include: { draft: true },
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

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
        campaign?.senderName
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

export const updateScheduledEmail = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const { pendingId } = req.params;
    const { subject, body } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const updated = await prisma.pendingEmail.update({
      where: { id: pendingId },
      data: { subject: subject.trim(), body: body.trim() },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update scheduled email' });
  }
};

export const sendScheduledEmailNow = async (req: CampaignRequest, res: Response, next: NextFunction) => {
  try {
    const { pendingId } = req.params;
    const userId = req.user!.id;

    const pending = await prisma.pendingEmail.findUnique({
      where: { id: pendingId },
      include: {
        lead: true,
        campaign: {
          include: {
            senderLinks: { include: { sender: { include: { domain: true } } } },
          },
        },
      },
    });

    if (!pending) return res.status(404).json({ error: 'Scheduled email not found' });
    if (pending.lead.status === 'UNSUBSCRIBED') {
      await prisma.pendingEmail.delete({ where: { id: pending.id } });
      return res.status(400).json({ error: 'Lead has unsubscribed and cannot be emailed.' });
    }

    const activeSenders = pending.campaign.senderLinks
      .map(l => l.sender)
      .filter(s => s.status === 'active' && s.domain?.status === 'active');

    if (activeSenders.length === 0) {
      return res.status(400).json({ error: 'No active sending mailboxes attached to this campaign.' });
    }

    const sender = activeSenders[0];

    const unsubscribeToken = await ensureUnsubscribeToken(pending.lead.id, pending.lead.unsubscribeToken);
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

    const { subject, body } = personalisationService.personalise(
      pending.lead,
      pending.subject,
      pending.body,
      pending.campaign.reference,
      sender.displayName || pending.campaign.senderName,
      unsubscribeUrl
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: sender.domainId,
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
      { leadId: pending.leadId, campaignId: pending.campaignId }
    );

    if (!result.success) {
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'FAILED', error: result.error },
      });
      throw new Error(result.error || 'Failed to dispatch email via Mailgun');
    }

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });

    await prisma.lead.update({
      where: { id: pending.leadId },
      data: { outreachStatus: 'SENT', status: 'CONTACTED' },
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
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.draft.findUnique({ where: { id: draftId } }),
    ]);

    if (!lead || !campaign || !draft) {
      return res.status(404).json({ error: 'Lead, Campaign, or Draft not found' });
    }

    const { subject, body } = personalisationService.personalise(
      lead,
      draft.subject,
      draft.body,
      campaign.reference,
      campaign.senderName
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
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          drafts: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          senderLinks: { include: { sender: { include: { domain: true } } } },
        },
      }),
    ]);

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found' });
    if (lead.status === 'UNSUBSCRIBED') return res.status(400).json({ error: 'This lead has unsubscribed' });
    const draft = campaign.drafts[0];
    if (!draft) return res.status(400).json({ error: 'No active draft found' });

    const activeSender = campaign.senderLinks.map(l => l.sender).find(s => s.status === 'active' && s.domain.status === 'active');
    if (!activeSender) return res.status(400).json({ error: 'No active sender attached to this campaign' });

    const unsubscribeToken = await ensureUnsubscribeToken(lead.id, lead.unsubscribeToken);
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

    const { subject, body } = personalisationService.personalise(
      lead,
      draft.subject,
      draft.body,
      campaign.reference,
      activeSender.displayName || campaign.senderName,
      unsubscribeUrl
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeSender.domainId,
        leadId,
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
      { leadId: lead.id, campaignId: campaign.id }
    );

    if (!result.success) throw new Error(result.error);

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { outreachStatus: 'SENT', status: 'CONTACTED' },
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

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { senderLinks: { include: { sender: { include: { domain: true } } } } },
    });

    if (!lead || !campaign) return res.status(404).json({ error: 'Lead or Campaign not found' });

    const latestIncoming = await prisma.outboundEmail.findFirst({
      where: { leadId, campaignId, isIncoming: true },
      orderBy: { sentAt: 'desc' },
    });

    const activeSenders = campaign.senderLinks.map(l => l.sender).filter(s => s.status === 'active' && s.domain.status === 'active');
    if (activeSenders.length === 0) return res.status(400).json({ error: 'No active sender found' });
    const activeSender = activeSenders.find(s => s.domainId === latestIncoming?.domainId) || activeSenders[0];

    const { subject: pSubject, body: pBody } = personalisationService.personalise(
      lead,
      subject,
      body,
      campaign.reference,
      activeSender.displayName || campaign.senderName
    );

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: activeSender.domainId,
        leadId,
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
      { leadId: lead.id, campaignId: campaign.id }
    );

    if (!result.success) throw new Error(result.error);

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId },
    });

    await prisma.draft.deleteMany({ where: { leadId, campaignId, isReplyDraft: true } });

    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    next(error);
  }
};