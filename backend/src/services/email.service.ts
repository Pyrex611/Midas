import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import prisma from '../lib/prisma';
import { decrypt } from '../lib/encryption';

export class EmailService {
  /**
   * Queue an email to be sent later, respecting the user's send limit.
   * Returns the queued email record.
   */
  async queueEmail(
    userId: string,
    leadId: string,
    campaignId: string,
    draftId: string | null,
    subject: string,
    body: string,
    inReplyTo?: string | null
  ) {
    // Create pending email record
    const pending = await prisma.pendingEmail.create({
      data: {
        userId,
        leadId,
        campaignId,
        draftId,
        subject,
        body,
        inReplyTo,
        status: 'PENDING',
      },
    });
    logger.info({ pendingId: pending.id, leadId }, 'Email queued');
    return pending;
  }

  /**
   * Actually send an email using the user's SMTP settings.
   * Called by the queue processor.
   */
  async sendEmailNow(
    userId: string,
    to: string,
    subject: string,
    html: string,
    text: string,
    senderName?: string | null,
    inReplyTo?: string | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      let transporter: nodemailer.Transporter;
      let from: string;

      if (settings && settings.smtpHost && settings.smtpUser && settings.smtpPass) {
        const smtpPass = decrypt(settings.smtpPass);
        transporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: settings.smtpPort || 587,
          secure: settings.smtpSecure ?? false,
          auth: {
            user: settings.smtpUser,
            pass: smtpPass,
          },
          logger: env.NODE_ENV === 'development',
          debug: env.NODE_ENV === 'development',
        });
        from = settings.emailFrom || env.EMAIL_FROM;
      } else {
        // fallback to global
        transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: parseInt(env.SMTP_PORT || '587'),
          secure: env.SMTP_SECURE === 'true',
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
          logger: env.NODE_ENV === 'development',
          debug: env.NODE_ENV === 'development',
        });
        from = env.EMAIL_FROM;
      }

      if (senderName) {
        const match = from.match(/<(.+)>/);
        if (match) {
          from = `"${senderName}" <${match[1]}>`;
        } else {
          from = `"${senderName}" <${from}>`;
        }
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