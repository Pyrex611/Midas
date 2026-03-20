import prisma from '../lib/prisma';
import nodemailer from 'nodemailer';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { mailboxService } from './mailbox.service';
import { personalisationService } from './personalisation.service';

export class EmailService {
  /**
   * Queue an email to be sent later.
   * Prevents duplicate scheduling for the same lead/campaign.
   */
  async queueEmail(
    userId: string,
    campaignId: string,
    leadId: string,
    draftId: string | null,
    subject: string,
    body: string,
    inReplyTo?: string | null,
    preferredMailboxId?: string | null
  ) {
    try {
      // 1. IDEMPOTENCY CHECK
      const existingPending = await prisma.pendingEmail.findFirst({
        where: {
          leadId,
          campaignId,
          status: 'PENDING'
        }
      });

      if (existingPending) {
        logger.debug({ leadId, campaignId }, 'Queueing skipped: Lead already has an email pending.');
        return existingPending;
      }

      // 2. Create the record
      const pending = await prisma.pendingEmail.create({
        data: {
          userId,
          campaignId,
          leadId,
          draftId,
          subject,
          body,
          inReplyTo,
          status: 'PENDING',
          preferredMailboxId,
        },
      });

      return pending;
    } catch (error: any) {
      logger.error({ error: error.message, leadId }, 'Failed to queue email in DB');
      throw error;
    }
  }

  /**
   * Actual SMTP send logic
   */
  async sendEmailNow(
    mailbox: any,
    to: string,
    subject: string,
    html: string,
    text: string,
    senderName?: string | null,
    inReplyTo?: string | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: mailbox.smtpHost,
        port: mailbox.smtpPort || 587,
        secure: mailbox.smtpSecure ?? false,
        auth: {
          user: mailbox.smtpUser,
          pass: mailbox.smtpPass,
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        dnsV_: 4,
        pool: false
      });

      let from = mailbox.email;
      if (senderName || mailbox.senderName) {
        from = `"${senderName || mailbox.senderName}" <${mailbox.email}>`;
      }

      const info = await transporter.sendMail({
        from, to, subject, text, html,
        inReplyTo: inReplyTo || undefined,
        references: inReplyTo ? [inReplyTo] : undefined
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.error({ error: error.message, to }, 'SMTP send failed');
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();