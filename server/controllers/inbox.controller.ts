import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { emailService } from '../services/email.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

/**
 * GET /api/inbox
 * Returns all leads that have an active conversation (either replied or contacted).
 */
export const getUnifiedInbox = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    
    const leadsWithThreads = await prisma.lead.findMany({
      where: {
        userId,
        OR: [
          { status: 'REPLIED' },
          { sentEmails: { some: {} } },
        ],
      },
      include: {
        campaign: { select: { id: true, name: true, senderName: true } },
        sentEmails: {
          orderBy: { sentAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(leadsWithThreads);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inbox/start
 * Initiates a brand-new conversation directly from the Inbox.
 */
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
      return res.status(400).json({ error: 'A sending mailbox (senderId) is required' });
    }

    // 1. Resolve Sender & Domain
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId, status: 'active' },
      include: { domain: true },
    });

    if (!sender || sender.domain.status !== 'active') {
      return res.status(400).json({ error: 'The selected sending mailbox or its domain is not active' });
    }

    // 2. Resolve or Upsert Lead
    let targetLead: any = null;

    if (leadId) {
      targetLead = await prisma.lead.findFirst({
        where: { id: leadId, userId },
      });
      if (!targetLead) return res.status(404).json({ error: 'Specified lead was not found' });
    } else {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'A valid recipient email address is required' });
      }

      const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

      targetLead = await prisma.lead.upsert({
        where: {
          userId_email: {
            userId,
            email: cleanEmail,
          },
        },
        update: {
          name: cleanName,
          company: company?.trim() || undefined,
          position: position?.trim() || undefined,
          status: 'CONTACTED',
          outreachStatus: saveAsLead ? 'DIRECT' : 'DIRECT_UNSAVED',
        },
        create: {
          userId,
          name: cleanName,
          email: cleanEmail,
          company: company?.trim() || null,
          position: position?.trim() || null,
          status: 'CONTACTED',
          outreachStatus: saveAsLead ? 'DIRECT' : 'DIRECT_UNSAVED',
        },
      });
    }

    if (targetLead.status === 'UNSUBSCRIBED') {
      return res.status(400).json({ error: 'This recipient has previously unsubscribed and cannot be emailed' });
    }

    // 3. Atomically claim mailbox quota
    const claimResult = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Sender"
      SET "sent_count_today" = "sent_count_today" + 1
      WHERE id = ${sender.id} AND "sent_count_today" < "daily_limit"
      RETURNING id
    `;

    if (claimResult.length === 0) {
      return res.status(400).json({ error: 'This sender mailbox has reached its daily quota limit. Please select another sender.' });
    }

    // 4. Create OutboundEmail record
    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: sender.domainId,
        leadId: targetLead.id,
        subject: subject.trim(),
        body: body.trim(),
        isIncoming: false,
        status: 'PROCESSING',
      },
    });

    // 5. Send via Mailgun
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
      { leadId: targetLead.id, campaignId: targetLead.campaignId }
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
      throw new Error(result.error || 'Failed to dispatch email via Mailgun');
    }

    // 6. Update OutboundEmail to SENT
    const finalizedEmail = await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });

    // 7. Log append-only telemetry
    await prisma.leadActivityEvent.create({
      data: {
        leadId: targetLead.id,
        eventType: 'EMAIL_SENT',
        metadata: {
          outboundEmailId: finalizedEmail.id,
          sender: `${sender.localPart}@${sender.domain.domainName}`,
          isDirectInbox: true,
        },
      },
    });

    logger.info({ leadId: targetLead.id, email: targetLead.email }, 'Direct conversation started from Unified Inbox');

    res.status(201).json({
      success: true,
      lead: targetLead,
      email: finalizedEmail,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to start conversation from inbox');
    next(error);
  }
};

/**
 * POST /api/inbox/:leadId/reply
 * Dispatches a manual reply to an existing inbound prospect message.
 */
export const sendManualReply = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const leadId = req.params.leadId as string;
    const { body } = req.body;

    if (!body?.trim()) return res.status(400).json({ error: 'Reply body is required' });

    const lead = await prisma.lead.findUnique({
      where: { id: leadId, userId },
      include: { 
        campaign: true,
        sentEmails: { 
          where: { isIncoming: true }, 
          orderBy: { sentAt: 'desc' }, 
          take: 1 
        } 
      }
    });

    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const latestInbound = lead.sentEmails[0];
    if (!latestInbound) return res.status(400).json({ error: 'No inbound email found to reply to' });

    const domain = await prisma.domain.findFirst({
      where: { id: latestInbound.domainId!, status: 'active' },
      include: { senders: { where: { status: 'active' }, take: 1 } },
    });

    if (!domain) return res.status(400).json({ error: 'Associated domain is not active' });

    const sender = domain.senders[0];
    const localPart = sender?.localPart || 'hello';

    const subject = latestInbound.subject.startsWith('Re:') ? latestInbound.subject : `Re: ${latestInbound.subject}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: domain.id,
        leadId: lead.id,
        campaignId: lead.campaignId,
        subject,
        body: body.trim(),
        isIncoming: false,
        status: 'PROCESSING',
        replyToId: latestInbound.id,
      }
    });

    const result = await emailService.sendEmailNow(
      { ...domain, senderLocalPart: localPart },
      lead.email,
      subject,
      body.trim().replace(/\n/g, '<br>'),
      body.trim(),
      outboundRecord.id,
      lead.campaign?.senderName || sender?.displayName || null,
      latestInbound.messageId,
      undefined,
      { leadId: lead.id, campaignId: lead.campaignId }
    );

    if (!result.success) throw new Error(result.error);

    const finalized = await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() }
    });

    await prisma.leadActivityEvent.create({
      data: {
        leadId: lead.id,
        campaignId: lead.campaignId,
        eventType: 'EMAIL_SENT',
        metadata: {
          outboundEmailId: finalized.id,
          isManualReply: true,
        },
      },
    });

    res.json({ success: true, email: finalized });
  } catch (error) {
    next(error);
  }
};