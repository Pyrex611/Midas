import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import prisma from '../lib/prisma';
import { mailboxService } from './mailbox.service';
import { personalisationService } from './personalisation.service';

export class EmailService {
  /**
   * Queue an email to be sent later, with optional preferred mailbox.
   * @param userId - The user who owns this email (required for backward compatibility)
   * @param campaignId - Campaign this email belongs to
   * @param leadId - Lead this email is for
   * @param draftId - Draft used (optional)
   * @param subject - Personalised subject
   * @param body - Personalised body
   * @param inReplyTo - Message ID to thread (for replies/follow‑ups)
   * @param preferredMailboxId - Optional preferred mailbox
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
    logger.debug({ userId, campaignId, leadId, subjectLength: subject.length }, 'Queueing email');

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
    logger.info({ pendingId: pending.id, leadId }, 'Email queued');
    return pending;
  }

  /**
   * Actually send an email using a specific mailbox (decrypted).
   * Called by the queue processor after mailbox selection.
   */
  async sendEmailNow(
    mailbox: any, // already decrypted mailbox object
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
        // 🔥 STABILITY SETTINGS:
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 30000,
        dnsV_ : 4, // Force IPv4 to avoid IPv6 routing issues on cloud providers
        pool: false // Use a single-use connection for cold outreach to avoid stale sockets
      });

      let from = mailbox.email;
      if (senderName || mailbox.senderName) {
        from = `"${senderName || mailbox.senderName}" <${mailbox.email}>`;
      }

      const mailOptions: any = {
        from,
        to,
        subject,
        text,
        html,
      };

      if (inReplyTo) {
        mailOptions.inReplyTo = inReplyTo;
        mailOptions.references = [inReplyTo];
      }

      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
      
    } catch (error: any) {
      logger.error({ error: error.message, to, subject }, 'SMTP Execution failed');
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();