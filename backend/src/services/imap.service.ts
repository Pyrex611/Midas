import Imap from 'imap';
import { simpleParser } from 'mailparser';
import EmailReplyParser from 'email-reply-parser';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { aiService } from './ai.service';
import { autoReplyService } from './autoReply.service';
import { mailboxService } from './mailbox.service';

/**
 * STRICT BOUNCE DETECTION
 * Only triggers if the 'From' is a known mailer daemon AND the subject matches bounce patterns.
 */
function isBounceMessage(parsed: any): boolean {
  const from = (parsed.from?.value[0]?.address || '').toLowerCase();
  const subject = (parsed.subject || '').toLowerCase();
  
  const bounceSenders = ['mailer-daemon@', 'postmaster@', 'mtaoutbound'];
  const bounceKeywords = ['delivery status notification', 'failed', 'undeliverable', 'returning message to sender'];

  const isFromDaemon = bounceSenders.some(daemon => from.includes(daemon));
  const hasBounceSubject = bounceKeywords.some(kw => subject.includes(kw));

  // It's only a bounce if it's from a daemon AND has bounce-like text
  return isFromDaemon && hasBounceSubject;
}

export class ImapService {
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;

  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollInterval = setInterval(() => this.poll(), 300000); 
    this.poll(); 
  }

  async poll() {
    logger.info('IMAP_CYCLE: Starting Multi-Mailbox Polling...');
    
    try {
      const mailboxes = await prisma.mailbox.findMany({
        where: { isActive: true, imapHost: { not: null } }
      });

      logger.info(`IMAP_CYCLE: Found ${mailboxes.length} active mailboxes in database.`);

      if (mailboxes.length === 0) return;

      for (const mb of mailboxes) {
        logger.info(`IMAP_SYNC: Starting sync for [${mb.email}]`);
        
        try {
          const decrypted = await mailboxService.getMailboxForSending(mb.id);
          const lookback = decrypted.lastPolledAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const sinceDate = this.formatImapDate(lookback);
          
          logger.debug(`IMAP_SYNC: Connecting to ${decrypted.imapHost} for ${decrypted.email}...`);
          
          // Execute connection with a hard 60s safety timeout to prevent hanging the whole loop
          await this.withTimeout(
            this.connectAndProcess(decrypted, sinceDate),
            60000,
            `Connection to ${decrypted.email} timed out after 60s`
          );

          await prisma.mailbox.update({
            where: { id: mb.id },
            data: { lastPolledAt: new Date(), status: 'HEALTHY', lastError: null }
          });

          logger.info(`IMAP_SYNC: Successfully finished sync for [${mb.email}]`);
          
        } catch (err: any) {
          logger.error({ mailbox: mb.email, error: err.message }, 'IMAP_SYNC_ERROR: Mailbox-specific failure');
          await prisma.mailbox.update({
            where: { id: mb.id },
            data: { status: 'DEGRADED', lastError: err.message }
          }).catch(() => {}); // Prevent double crash
        }
      }
      logger.info('IMAP_CYCLE: Completed all mailboxes.');
    } catch (error: any) {
      logger.error({ error: error.message }, 'IMAP_CYCLE_CRITICAL: Global loop failure');
    }
  }
  
  async manualPoll() {
    logger.info('IMAP_MANUAL: Triggering out-of-band poll...');
    this.consecutiveErrors = 0;
    try {
      await this.poll();
      return { success: true };
    } catch (err: any) {
      logger.error({ err: err.message }, 'IMAP_MANUAL_ERROR');
      throw err;
    }
  }

  /**
   * Helper to prevent the entire service from hanging if a single socket gets stuck
   */
  private withTimeout(promise: Promise<any>, ms: number, exception: string) {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(exception)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  private formatImapDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  }

  private connectAndProcess(mailbox: any, sinceDate: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: mailbox.imapUser,
        password: mailbox.imapPass,
        host: mailbox.imapHost,
        port: mailbox.imapPort || 993,
        tls: mailbox.imapSecure ?? true,
        tlsOptions: { 
          rejectUnauthorized: false,
          servername: mailbox.imapHost 
        },
        connTimeout: 30000,
        authTimeout: 30000,
        keepalive: false // Disable keepalive for short polling bursts
      });

      let hasFinished = false;

      const cleanup = () => {
        if (!hasFinished) {
          hasFinished = true;
          imap.end();
        }
      };

      imap.once('ready', () => {
        logger.debug(`IMAP_STATE: Ready [${mailbox.email}]`);
        imap.openBox('INBOX', false, (err, box) => {
          if (err) { cleanup(); return reject(err); }

          imap.search(['UNSEEN', ['SINCE', sinceDate]], (err, results) => {
            if (err) { cleanup(); return reject(err); }
            
            if (!results || results.length === 0) {
              logger.debug(`IMAP_STATE: No new messages for [${mailbox.email}]`);
              cleanup();
              return resolve();
            }

            logger.info(`IMAP_STATE: Fetching ${results.length} new messages for [${mailbox.email}]`);
            const fetch = imap.fetch(results, { bodies: '', struct: true });
            let processed = 0;

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                this.processMessage(mailbox, stream).then(() => {
                  processed++;
                  if (processed === results.length) {
                    cleanup();
                    resolve();
                  }
                }).catch(e => logger.error(`IMAP_MSG_ERR: ${e.message}`));
              });
            });

            fetch.once('error', (fetchErr) => {
              cleanup();
              reject(fetchErr);
            });
          });
        });
      });

      imap.once('error', (err) => {
        logger.error(`IMAP_SOCKET_ERR: [${mailbox.email}] ${err.message}`);
        cleanup();
        reject(err);
      });

      imap.once('end', () => {
        logger.debug(`IMAP_STATE: Closed [${mailbox.email}]`);
        if (!hasFinished) {
          hasFinished = true;
          resolve();
        }
      });

      imap.connect();
    });
  }

  private async processMessage(mailbox: any, stream: any) {
    const parsed = await simpleParser(stream);
    const messageId = parsed.messageId?.trim();
    if (!messageId) return;

    const inReplyTo = parsed.inReplyTo?.trim();
    const text = parsed.text || '';

    // Search for original email context
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

    // 1. Bounce Detection
    const from = parsed.from?.value[0]?.address?.toLowerCase() || '';
    const subject = (parsed.subject || '').toLowerCase();
		
    if (from === mailbox.email.toLowerCase() || from.includes('accounts.google.com')) {
      return; 
    }
		
    if (isBounceMessage(parsed)) {
      if (originalEmail) {
        // Only record as bounce if we found the original email it belongs to
        logger.warn(`BOUNCE_CONFIRMED: Lead ${originalEmail.leadId} from Mailbox ${mailbox.email}`);
        await prisma.$transaction([
          prisma.mailbox.update({
            where: { id: mailbox.id },
            data: { bounceCount: { increment: 1 }, status: 'DEGRADED' }
          }),
          prisma.lead.update({
            where: { id: originalEmail.leadId },
            data: { outreachStatus: 'BOUNCED' }
          })
        ]);
      }
      return;
    }

    if (!originalEmail) return;

    const existing = await prisma.outboundEmail.findFirst({ where: { messageId } });
    if (existing) return;

    // 2. Reply Recording
    logger.info(`IMAP_EVENT: Valid reply detected from [${from}] for campaign [${originalEmail.campaignId}]`);
    
    await prisma.$transaction([
      prisma.mailbox.update({ where: { id: mailbox.id }, data: { replyCount: { increment: 1 } } }),
      prisma.outboundEmail.create({
        data: {
          userId: originalEmail.userId,
          leadId: originalEmail.leadId,
          campaignId: originalEmail.campaignId,
          mailboxId: mailbox.id,
          subject: parsed.subject || '',
          body: new EmailReplyParser().parseReply(text) || text,
          isIncoming: true,
          messageId,
          replyToId: originalEmail.id,
          sentAt: parsed.date || new Date(),
          status: 'SENT',
        }
      }),
      prisma.outboundEmail.update({ where: { id: originalEmail.id }, data: { repliedAt: new Date() } })
    ]);

    // 3. AI Intelligence
    try {
      const analysis = await aiService.analyzeReply(parsed.text || '');
      await prisma.outboundEmail.update({
        where: { messageId },
        data: { sentiment: analysis.sentiment, intent: analysis.intent, analysis: JSON.stringify(analysis) }
      });
      autoReplyService.processReply(messageId).catch(e => logger.error(`AUTO_REPLY_ERR: ${e.message}`));
    } catch (e: any) { 
      logger.error(`AI_ANALYSIS_ERR: ${e.message}`); 
    }
  }

  stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.isPolling = false;
  }
}

export const imapService = new ImapService();