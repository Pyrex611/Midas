import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { emailService } from '../services/email.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const getUnifiedInbox = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    
    const repliedLeads = await prisma.lead.findMany({
      where: { userId, status: 'REPLIED' },
      include: {
        campaign: { select: { id: true, name: true, senderName: true } },
        sentEmails: {
          orderBy: { sentAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(repliedLeads);
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
          where: { isIncoming: true }, 
          orderBy: { sentAt: 'desc' }, 
          take: 1 
        } 
      }
    });

    if (!lead || !lead.campaign) return res.status(404).json({ error: 'Lead or Campaign not found' });

    const latestInbound = lead.sentEmails[0];
    if (!latestInbound) return res.status(400).json({ error: 'No inbound email to reply to' });

    const domain = await prisma.domain.findFirst({
      where: { id: latestInbound.domainId!, status: 'active' }
    });

    if (!domain) return res.status(400).json({ error: 'Associated domain is not active' });

    const subject = latestInbound.subject.startsWith('Re:') ? latestInbound.subject : `Re: ${latestInbound.subject}`;

    const outboundRecord = await prisma.outboundEmail.create({
      data: {
        userId,
        domainId: domain.id,
        leadId: lead.id,
        campaignId: lead.campaignId,
        subject,
        body,
        isIncoming: false,
        status: 'PROCESSING',
        replyToId: latestInbound.id,
      }
    });

    const result = await emailService.sendEmailNow(
      domain,
      lead.email,
      subject,
      body.replace(/\n/g, '<br>'),
      body,
      outboundRecord.id,
      lead.campaign.senderName,
      latestInbound.messageId
    );

    if (!result.success) throw new Error(result.error);

    await prisma.outboundEmail.update({
      where: { id: outboundRecord.id },
      data: { status: 'SENT', messageId: result.messageId }
    });

    res.json({ success: true, email: outboundRecord });

  } catch (error) {
    next(error);
  }
};