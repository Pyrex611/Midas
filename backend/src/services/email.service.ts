import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private useEthereal: boolean;

  constructor() {
    this.useEthereal = env.EMAIL_SERVICE === 'ethereal';
    // Do not auto-init; init on first send to allow env changes
  }

  private async initTransporter() {
    if (this.useEthereal) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info('Email service using Ethereal (preview mode)');
      } catch (error) {
        logger.error({ error }, 'Failed to create Ethereal test account');
        throw new Error('Could not initialize Ethereal email service');
      }
    } else {
      // SMTP mode
      if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
        throw new Error('SMTP configuration missing when EMAIL_SERVICE=smtp');
      }
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: parseInt(env.SMTP_PORT || '587'),
        secure: env.SMTP_SECURE === 'true',
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      logger.info('Email service using SMTP (production mode)');
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
    senderName?: string | null,
    inReplyTo?: string | null
  ) {
    // Ensure transporter is ready
    if (!this.transporter) {
      await this.initTransporter();
    }

    // Build from address
    let fromEmail = env.EMAIL_FROM;
    const match = env.EMAIL_FROM.match(/<(.+)>/);
    if (match) {
      fromEmail = match[1];
    }
    const from = senderName ? `"${senderName}" <${fromEmail}>` : env.EMAIL_FROM;

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

    try {
      const info = await this.transporter!.sendMail(mailOptions);
      const messageId = info.messageId;

      if (this.useEthereal) {
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