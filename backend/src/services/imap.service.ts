import Imap from 'imap';
import { simpleParser } from 'mailparser';
import EmailReplyParser from 'email-reply-parser'; // ✅ Default import (class)
import { env } from '../config/env';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import dns from 'dns';

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
    this.poll().catch(err => {
      logger.error({ err }, 'IMAP poll error (will retry)');
    });
    this.pollInterval = setInterval(() => {
      this.poll().catch(err => {
        logger.error({ err }, 'IMAP poll error (will retry)');
      });
    }, env.IMAP_POLL_INTERVAL);
  }

  async poll() {
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      logger.error(`IMAP poll stopped after ${this.maxConsecutiveErrors} consecutive failures.`);
      this.stopPolling();
      return;
    }

    logger.debug('IMAP poll started');
    try {
      const { address } = await dns.promises.lookup(env.IMAP_HOST);
      logger.info({ host: env.IMAP_HOST, resolvedIp: address, port: env.IMAP_PORT }, 'Attempting IMAP connection');

      const sinceDate = await this.getSinceDate();
      await this.connectAndProcess(sinceDate);
      this.consecutiveErrors = 0;
    } catch (error) {
      this.consecutiveErrors++;
      logger.error({ error, consecutiveErrors: this.consecutiveErrors }, 'IMAP poll failed');
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
        logger.info('IMAP connection established');

        imap.openBox(env.IMAP_MAILBOX, false, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.search(['UNSEEN', ['SINCE', sinceDate]], (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              logger.debug('No new unseen messages');
              imap.end();
              return resolve();
            }

            const fetch = imap.fetch(results, { bodies: '', struct: true });
            let processed = 0;

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                this.processMessage(stream).then(() => {
                  processed++;
                }).catch(err => logger.error({ err }, 'Process message error'));
              });
            });

            fetch.once('error', (err) => {
              imap.end();
              reject(err);
            });

            fetch.once('end', () => {
              logger.info(`Processed ${processed} messages`);
              imap.end();
              resolve();
            });
          });
        });
      });

      imap.once('error', (err) => {
        if (resolved) return;
        resolved = true;
        logger.error({ err }, 'IMAP connection error');
        imap.end();
        reject(err);
      });

      imap.connect();
    });
  }

  private async processMessage(stream: any) {
    const parsed = await simpleParser(stream);
    const messageId = parsed.messageId?.trim();
    const inReplyTo = parsed.inReplyTo?.trim();
    let references: string[] = [];
    if (parsed.references) {
      if (Array.isArray(parsed.references)) {
        references = parsed.references;
      } else if (typeof parsed.references === 'string') {
        references = [parsed.references];
      }
    }
    const from = parsed.from?.value[0]?.address;
    const to = parsed.to?.value[0]?.address;
    const subject = parsed.subject || '';
    const text = parsed.text || '';
    const html = parsed.html || '';

    // Extract only the reply (strip quoted original)
    let replyText = text;
    try {
      const parser = new EmailReplyParser(); // ✅ Instantiate class
      replyText = parser.parseReply(text) || text;
    } catch (e) {
      logger.warn({ err: e }, 'Failed to parse reply, using full text');
    }

    if (!from || !messageId) {
      logger.warn({ from, messageId }, 'Missing headers, skipping');
      return;
    }

    // Find original email
    let originalEmail = null;
    const searchIds = [];
    if (inReplyTo) searchIds.push(inReplyTo);
    if (references.length) searchIds.push(...references);

    if (searchIds.length > 0) {
      originalEmail = await prisma.outboundEmail.findFirst({
        where: { messageId: { in: searchIds }, isIncoming: false },
      });
    }

    if (!originalEmail) {
      logger.debug({ messageId }, 'No matching outbound email');
      return;
    }

    const existing = await prisma.outboundEmail.findFirst({ where: { messageId } });
    if (existing) return;

    await prisma.outboundEmail.create({
      data: {
        leadId: originalEmail.leadId,
        campaignId: originalEmail.campaignId,
        subject,
        body: replyText, // ✅ stripped reply
        isIncoming: true,
        messageId,
        inReplyTo,
        references: references.join(' '),
        fromAddress: from,
        toAddress: to,
        replyToId: originalEmail.id,
        sentAt: parsed.date || new Date(),
        status: 'SENT',
      },
    });

    await prisma.outboundEmail.update({
      where: { id: originalEmail.id },
      data: { repliedAt: new Date() },
    });

    logger.info({ messageId, originalId: originalEmail.id }, 'Stored inbound reply');
  }

  async manualPoll() {
    this.consecutiveErrors = 0;
    await this.poll();
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }
}

export const imapService = new ImapService();