import Imap from 'imap';
import { simpleParser } from 'mailparser';
import EmailReplyParser from 'email-reply-parser';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import dns from 'dns';
import { aiService } from './ai.service';
import { autoReplyService } from './autoReply.service';

function isBounceMessage(parsed: any): boolean {
  const from = parsed.from?.value[0]?.address?.toLowerCase() || '';
  const subject = parsed.subject?.toLowerCase() || '';
  return (
    from.includes('mailer-daemon') ||
    from.includes('postmaster') ||
    subject.includes('delivery status notification') ||
    subject.includes('failure') ||
    subject.includes('undeliverable')
  );
}

export class ImapService {
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 5;

  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.schedulePoll();
  }

  private schedulePoll() {
    this.poll().catch(err => logger.error({ err }, 'Initial IMAP poll error'));
    this.pollInterval = setInterval(() => {
      this.poll().catch(err => logger.error({ err }, 'IMAP poll interval error'));
    }, env.IMAP_POLL_INTERVAL);
  }

  async poll() {
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      this.stopPolling();
      return;
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
      await this.connectAndProcess(await this.getSinceDate());
      this.consecutiveErrors = 0;
    } catch (error: any) {
      this.consecutiveErrors++;
      logger.error('IMAP poll failed logic');
    }
  }

  private async getSinceDate(): Promise<string> {
    const oldestCampaign = await prisma.campaign.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const sinceDate = oldestCampaign?.createdAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.formatImapDate(sinceDate);
  }

  private formatImapDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  }

  private connectAndProcess(sinceDate: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: env.IMAP_USER,
        password: env.IMAP_PASS,
        host: env.IMAP_HOST,
        port: env.IMAP_PORT,
        tls: env.IMAP_TLS === 'true',
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: env.IMAP_CONN_TIMEOUT,
      });

      let resolved = false;
      imap.once('ready', () => {
        if (resolved) return;
        resolved = true;
        logger.info({ user: env.IMAP_USER }, 'IMAP connection established');

        imap.openBox(env.IMAP_MAILBOX, false, (err, box) => {
          if (err) { imap.end(); return reject(err); }

          imap.search(['UNSEEN', ['SINCE', sinceDate]], (err, results) => {
            if (err) { imap.end(); return reject(err); }
            if (!results || results.length === 0) { imap.end(); return resolve(); }

            const fetch = imap.fetch(results, { bodies: '', struct: true });
            let processed = 0;
            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                this.processMessage(stream).then(() => { processed++; }).catch(e => logger.error(e));
              });
            });
            fetch.once('end', () => { imap.end(); resolve(); });
          });
        });
      });
      imap.once('error', (err) => { if (!resolved) { resolved = true; imap.end(); reject(err); } });
      imap.connect();
    });
  }

  private async processMessage(stream: any) {
    const parsed = await simpleParser(stream);
    const messageId = parsed.messageId?.trim();
    const inReplyTo = parsed.inReplyTo?.trim();
    const from = parsed.from?.value[0]?.address;
    const text = parsed.text || '';

    // Search IDs for threading
    const searchIds = [];
    if (inReplyTo) searchIds.push(inReplyTo);
    if (parsed.references) {
        const refs = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
        searchIds.push(...refs);
    }

    let originalEmail = null;
    if (searchIds.length > 0) {
        originalEmail = await prisma.outboundEmail.findFirst({
            where: { messageId: { in: searchIds }, isIncoming: false },
            select: { id: true, leadId: true, campaignId: true, userId: true, mailboxId: true },
        });
    }

    if (isBounceMessage(parsed)) {
      if (originalEmail) {
        // 🔥 UPDATE ANALYTICS ON BOUNCE
        if (originalEmail.mailboxId) {
            await prisma.mailbox.update({
                where: { id: originalEmail.mailboxId },
                data: { bounceCount: { increment: 1 }, status: 'DEGRADED', lastError: `Bounce from: ${from}` }
            });
        }
        await prisma.lead.update({
          where: { id: originalEmail.leadId },
          data: { outreachStatus: 'BOUNCED', status: 'NEW' },
        });
      }
      return;
    }

    if (!from || !messageId || !originalEmail) return;

    const existing = await prisma.outboundEmail.findFirst({ where: { messageId } });
    if (existing) return;

    // 🔥 UPDATE ANALYTICS ON REPLY
    if (originalEmail.mailboxId) {
        await prisma.mailbox.update({
            where: { id: originalEmail.mailboxId },
            data: { replyCount: { increment: 1 } }
        });
    }

    const newEmail = await prisma.outboundEmail.create({
      data: {
        userId: originalEmail.userId,
        leadId: originalEmail.leadId,
        campaignId: originalEmail.campaignId,
        mailboxId: originalEmail.mailboxId,
        subject: parsed.subject || '',
        body: new EmailReplyParser().parseReply(text) || text,
        isIncoming: true,
        messageId,
        replyToId: originalEmail.id,
        sentAt: parsed.date || new Date(),
        status: 'SENT',
      },
    });

    await prisma.outboundEmail.update({ where: { id: originalEmail.id }, data: { repliedAt: new Date() } });

    try {
      const analysis = await aiService.analyzeReply(newEmail.body);
      await prisma.outboundEmail.update({
        where: { id: newEmail.id },
        data: { sentiment: analysis.sentiment, intent: analysis.intent, analysis: JSON.stringify(analysis) },
      });
      autoReplyService.processReply(newEmail.id).catch(e => logger.error(e));
    } catch (e) { logger.error(e); }
  }

  manualPoll() { this.consecutiveErrors = 0; return this.poll(); }
  stopPolling() { if (this.pollInterval) clearInterval(this.pollInterval); this.isPolling = false; }
}

export const imapService = new ImapService();