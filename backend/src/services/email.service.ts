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
				connectionTimeout: 20000, // 20 seconds
				greetingTimeout: 20000,
				socketTimeout: 20000,
				dnsV_ : 4, // Force IPv4
        logger: env.NODE_ENV === 'development',
        debug: env.NODE_ENV === 'development',
      });

      let from = mailbox.email;
      if (mailbox.senderName) {
        from = `"${mailbox.senderName}" <${mailbox.email}>`;
      }
      if (senderName) {
        // Override sender name if provided (e.g., from campaign)
        from = `"${senderName}" <${mailbox.email}>`;
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
      const messageId = info.messageId;

      if (env.EMAIL_SERVICE === 'ethereal') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info({ previewUrl, to, subject, messageId }, 'Email preview generated');
        return { success: true, previewUrl, messageId };
      } else {
        if (!messageId) {
          throw new Error('No messageId returned from SMTP server');
        }
        logger.info({ messageId, to, subject }, 'Email sent via SMTP');
        return { success: true, messageId };
      }
    } catch (error: any) {
      logger.error({ error, to, subject }, 'Email sending failed');
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();