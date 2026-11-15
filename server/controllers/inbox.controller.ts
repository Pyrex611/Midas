import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { emailService } from '../services/email.service';
import { senderService } from '../services/sender.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

/**
 * GET /api/inbox?domainId=...&senderId=...
 * Supports filtering threads cleanly by Domain or a specific Sender mailbox.
 */
export const getUnifiedInbox = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const domainId = (req.query.domainId as string | undefined)?.trim();
    const senderId = (req.query.senderId as string | undefined)?.trim();

    let emailFilter: any = undefined;

    if (senderId && senderId !== 'all') {
      const sender = await prisma.sender.findFirst({
        where: { id: senderId, userId },
        include: { domain: { select: { domainName: true } } },
      });
      if (!sender) {
        return res.status(404).json({ error: 'Selected mailbox sender not found' });
      }
      const senderAddress = `${sender.localPart}@${sender.domain.domainName}`.toLowerCase();

      emailFilter = {
        some: {
          OR: [
            { senderId: sender.id },
            { fromAddress: { contains: senderAddress, mode: 'insensitive' } },
            { toAddress: { contains: senderAddress, mode: 'insensitive' } },
          ],
        },
      };
    } else if (domainId && domainId !== 'all') {
      emailFilter = {
        some: { domainId },
      };
    }

    const activeThreads = await prisma.lead.findMany({
      where: {
        userId,
        OR: [{ status: 'REPLIED' }, { status: 'CONTACTED' }],
        sentEmails: emailFilter || { some: {} },
      },
      include: {
        campaign: { select: { id: true, name: true, senderName: true } },
        sentEmails: {
          include: {
            domain: { select: { id: true, domainName: true } },
            sender: { select: { id: true, localPart: true, displayName: true } },
          },
          orderBy: { sentAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(activeThreads);
  } catch (error) {
    next(error);
  }
};

export const startConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      leadId,
      name,
      email,
      company,
      position,
      saveAsLead = true,
      senderId,
      subject,
      body,
    } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and email body are required' });
    }
    if (!senderId) {
      return res.status(400).json({ error: 'Please select an active mailbox sender to send from' });
    }

    let sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
      include: { domain: true },
    });
    if (!sender || sender.status !== 'active' || sender.domain?.status !== 'active') {
      return res.status(400).json({ error: 'Selected sender mailbox or domain is not active' });
    }

    sender = await senderService.ensureSenderDailyReset(sender.id);
    if (sender.sentCountToday >= sender.dailyLimit) {
      return res.status(429).json({ error: 'Selected sender mailbox has reached its daily quota limit' });
    }

    let targetLead: any = null;
    if (leadId) {
      targetLead = await prisma.lead.findFirst({ where: { id: leadId, userId } });
      if (!targetLead) return res.status(404).json({ error: 'Selected lead not found' });
    } else {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'A valid recipient email address is required' });
      }
      const resolvedName = (name || '').trim() || cleanEmail.split('@')[0];

      targetLead = await prisma.lead.upsert({
        where: { userId_email: { userId, email: cleanEmail } },
        update: {
          name: resolvedName,
          company: company?.trim() || undefined,
          position: position?.trim() || undefined,
        },
        create: {
          userId,
          email: cleanEmail,
          name: resolvedName,
          company: company?.trim() || null,
          position: position?.trim() || null,
          status: saveAsLead ? 'CONTACTED' : 'NEW',
          outreachStatus: 'SENT',
        },
      });
    }

    const fromEmail = `${sender.localPart}@${sender.domain.domainName}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: sender.domainId,
        senderId: sender.id,
        fromAddress: fromEmail,
        toAddress: targetLead.email,
        leadId: targetLead.id,
        subject: subject.trim(),
        body: body.trim(),
        isIncoming: false,
        status: 'PROCESSING',
      },
    });

    const userSettings = await prisma.userSettings.findUnique({ where: { userId } });

    const result = await emailService.sendEmailNow(
      { ...sender.domain, senderLocalPart: sender.localPart },
      targetLead.email,
      subject.trim(),
      body.trim().replace(/\n/g, '<br>'),
      body.trim(),
      outboundRecord.id,
      sender.displayName || null,
      undefined,
      undefined,
      { leadId: targetLead.id },
      {
        brandName: userSettings?.companyName,
        brandInitials: userSettings?.brandInitials,
        brandColorHex: userSettings?.brandColorHex,
        logoUrl: userSettings?.logoUrl,
        brandingEnabled: userSettings?.brandingEnabled,
      }
    );

    if (!result.success) {
      await prisma.outboundEmail.update({
        where: { id: outboundRecord.id },
        data: { status: 'FAILED', error: result.error },
      });
      return res.status(400).json({ error: result.error || 'Failed to dispatch email' });
    }

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });

    await prisma.sender.update({
      where: { id: sender.id },
      data: { sentCountToday: { increment: 1 }, lastDispatchedAt: new Date() },
    });

    await prisma.lead.update({
      where: { id: targetLead.id },
      data: { status: 'CONTACTED', outreachStatus: 'SENT' },
    });

    await prisma.leadActivityEvent.create({
      data: {
        leadId: targetLead.id,
        eventType: 'EMAIL_SENT',
        metadata: { outboundEmailId: outboundRecord.id, isManualDirect: true, senderId: sender.id },
      },
    });

    logger.info({ leadId: targetLead.id, outboundId: outboundRecord.id }, 'Direct conversation initiated from Inbox');
    res.status(201).json({ success: true, email: outboundRecord, lead: targetLead });
  } catch (error) {
    next(error);
  }
};

export const sendManualReply = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const leadId = req.params.leadId as string;
    const { body } = req.body;

    if (!body) return res.status(400).json({ error: 'Reply body is required' });

    const lead = await prisma.lead.findUnique({
      where: { id: leadId, userId },
      include: {
        campaign: true,
        sentEmails: {
          orderBy: { sentAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const latestEmail = lead.sentEmails[0];
    if (!latestEmail || !latestEmail.domainId) return res.status(400).json({ error: 'No previous email context to reply to' });

    const domain = await prisma.domain.findFirst({
      where: { id: latestEmail.domainId, status: 'active' },
      include: { senders: true },
    });

    if (!domain) return res.status(400).json({ error: 'Associated domain is not active' });

    const matchedSender =
      (latestEmail.senderId ? domain.senders.find((s) => s.id === latestEmail.senderId) : undefined) ||
      domain.senders.find((s) => s.status === 'active') ||
      domain.senders[0];

    const fromEmail = matchedSender ? `${matchedSender.localPart}@${domain.domainName}` : undefined;
    const subject = latestEmail.subject.startsWith('Re:') ? latestEmail.subject : `Re: ${latestEmail.subject}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: domain.id,
        senderId: matchedSender?.id || null,
        fromAddress: fromEmail,
        toAddress: lead.email,
        leadId: lead.id,
        campaignId: lead.campaignId,
        subject,
        body,
        isIncoming: false,
        status: 'PROCESSING',
        replyToId: latestEmail.id,
      },
    });

    const userSettings = await prisma.userSettings.findUnique({ where: { userId } });

    const result = await emailService.sendEmailNow(
      { ...domain, senderLocalPart: matchedSender?.localPart || 'hello' },
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      matchedSender?.displayName || lead.campaign?.senderName || null,
      latestEmail.messageId,
      undefined,
      { leadId: lead.id, campaignId: lead.campaignId },
      {
        brandName: userSettings?.companyName,
        brandInitials: userSettings?.brandInitials,
        brandColorHex: userSettings?.brandColorHex,
        logoUrl: userSettings?.logoUrl,
        brandingEnabled: userSettings?.brandingEnabled,
      }
    );

    if (!result.success) throw new Error(result.error);

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });

    res.json({ success: true, email: outboundRecord });
  } catch (error) {
    next(error);
  }
};