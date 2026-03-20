import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import prisma from '../lib/prisma';
import { mailboxService } from './mailbox.service';
import { personalisationService } from './personalisation.service';

export class EmailService {
  /**
   * Queue an email to be sent later.
   * IMPROVED: Includes a check to prevent duplicate scheduling for the same lead/campaign.
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
    // 🔥 IDEMPOTENCY CHECK:
    // Check if there is already a PENDING email for this specific lead in this campaign.
    const existingPending = await prisma.pendingEmail.findFirst({
      where: {
        leadId,
        campaignId,
        status: 'PENDING'
      }
    });

    if (existingPending) {
      logger.debug({ leadId, campaignId }, 'Queueing skipped: Lead already has an email pending for this campaign.');
      return existingPending;
    }

    // Create the record if no duplicate exists
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

    logger.info({ pendingId: pending.id, leadId }, 'Email successfully queued.');
    return pending;
  }

  /**
   * Actual SMTP send logic (Re-using stable version from previous turn)
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
        dnsV_ : 4,
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