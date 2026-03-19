import Imap from 'imap';
import { simpleParser } from 'mailparser';
import EmailReplyParser from 'email-reply-parser';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService } from './ai.service';
import { autoReplyService } from './autoReply.service';
import { mailboxService } from './mailbox.service'; // 🔥 Needed for decryption

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

  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    
    // Run every 5 minutes (standard interval)
    this.pollInterval = setInterval(() => this.poll(), 300000); 
    this.poll(); // Initial run
  }

  async poll() {
    logger.info('Starting Multi-Mailbox IMAP Polling Cycle...');
    
    try {
      // 1. Fetch all active mailboxes that have IMAP configured
      const mailboxes = await prisma.mailbox.findMany({
        where: { 
          isActive: true,
          imapHost: { not: null },
          imapUser: { not: null }
        }
      });

      if (mailboxes.length === 0) {
        logger.warn('No mailboxes configured for IMAP polling.');
        return;
      }

      // 2. Iterate through each mailbox sequentially
      for (const mb of mailboxes) {
        try {
          // Decrypt credentials using our trusted service
          const decrypted = await mailboxService.getMailboxForSending(mb.id);
          const sinceDate = this.formatImapDate(mb.lastPolledAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          
          logger.debug({ user: decrypted.email }, 'Polling mailbox...');
          
          await this.connectAndProcess(decrypted, sinceDate);
          
          // 🔥 Update the lastPolledAt on success
          await prisma.mailbox.update({
            where: { id: mb.id },
            data: { lastPolledAt: new Date(), status: 'HEALTHY' }
          });
          
        } catch (err: any) {
          logger.error({ err: err.message, mailbox: mb.email }, 'Failed to poll individual mailbox');
          // We continue to the next mailbox even if one fails
          await prisma.mailbox.update({
            where: { id: mb.id },
            data: { status: 'DEGRADED', lastError: `IMAP Error: ${err.message}` }
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Critical error in global poll loop');
    }
  }

  private formatImapDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  }

  private connectAndProcess(mailbox: any, sinceDate: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: mailbox.imapUser,
        password: mailbox.imapPass, // Plaintext via decryption
        host: mailbox.imapHost,
        port: mailbox.imapPort || 993,
        tls: mailbox.imapSecure ?? true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 30000,
      });

      let resolved = false;

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) { imap.end(); return reject(err); }

          imap.search(['UNSEEN', ['SINCE', sinceDate]], (err, results) => {
            if (err) { imap.end(); return reject(err); }
            if (!results || results.length === 0) { imap.end(); return resolve(); }

            const fetch = imap.fetch(results, { bodies: '', struct: true });
            let processed = 0;

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                this.processMessage(mailbox, stream).then(() => {
                  processed++;
                }).catch(e => logger.error(e));
              });
            });

            fetch.once('end', () => {
              if (processed > 0) logger.info({ user: mailbox.email, count: processed }, 'Processed messages');
              imap.end();
              resolve();
            });
          });
        });
      });

      imap.once('error', (err) => { if (!resolved) { resolved = true; imap.end(); reject(err); } });
      imap.connect();
    });
  }

  private async processMessage(mailbox: any, stream: any) {
    const parsed = await simpleParser(stream);
    const messageId = parsed.messageId?.trim();
    const inReplyTo = parsed.inReplyTo?.trim();
    const text = parsed.text || '';

    const searchIds = [];
    if (inReplyTo) searchIds.push(inReplyTo);
    if (parsed.references) {
        const refs = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
        searchIds.push(...refs);
    }

    let originalEmail = null;
    if (searchIds.length > 0) {
        originalEmail = await prisma.outboundEmail.findFirst({
            where: { messageId: { in: searchIds } },
            select: { id: true, leadId: true, campaignId: true, userId: true, mailboxId: true },
        });
    }

    // 1. Handle Bounces
    if (isBounceMessage(parsed)) {
      if (originalEmail) {
        await prisma.$transaction([
          prisma.mailbox.update({
            where: { id: mailbox.id },
            data: { bounceCount: { increment: 1 }, status: 'DEGRADED', lastError: `Bounce detected in ${mailbox.email}` }
          }),
          prisma.lead.update({
            where: { id: originalEmail.leadId },
            data: { outreachStatus: 'BOUNCED', status: 'NEW' }
          })
        ]);
      }
      return;
    }

    if (!messageId || !originalEmail) return;

    const existing = await prisma.outboundEmail.findFirst({ where: { messageId } });
    if (existing) return;

    // 2. Handle Replies
    await prisma.$transaction([
      prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { replyCount: { increment: 1 } }
      }),
      prisma.outboundEmail.create({
        data: {
          userId: originalEmail.userId,
          leadId: originalEmail.leadId,
          campaignId: originalEmail.campaignId,
          mailboxId: mailbox.id, // 🔥 Correctly attribute to the mailbox being polled
          subject: parsed.subject || '',
          body: new EmailReplyParser().parseReply(text) || text,
          isIncoming: true,
          messageId,
          replyToId: originalEmail.id,
          sentAt: parsed.date || new Date(),
          status: 'SENT',
        }
      }),
      prisma.outboundEmail.update({
        where: { id: originalEmail.id },
        data: { repliedAt: new Date() }
      })
    ]);

    // 3. AI Sentiment & Auto-Reply
    try {
      const analysis = await aiService.analyzeReply(parsed.text || '');
      await prisma.outboundEmail.update({
        where: { messageId },
        data: { sentiment: analysis.sentiment, intent: analysis.intent, analysis: JSON.stringify(analysis) }
      });
      autoReplyService.processReply(messageId).catch(e => logger.error(e));
    } catch (e) { logger.error(e); }
  }

  stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.isPolling = false;
  }
}

export const imapService = new ImapService();