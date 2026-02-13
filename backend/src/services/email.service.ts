import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Use Ethereal for development (fake SMTP, messages never delivered)
const createTestAccount = async () => {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

// Production SMTP (configure via env)
const createProductionTransport = () => {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || '587'),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
};

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private previewMode: boolean;

  constructor(previewMode = true) {
    this.previewMode = previewMode; // true = development, false = production
    this.initTransporter();
  }

  private async initTransporter() {
    if (this.previewMode) {
      this.transporter = await createTestAccount();
      logger.info('Email service in PREVIEW mode (Ethereal)');
    } else {
      this.transporter = createProductionTransport();
      logger.info('Email service in PRODUCTION mode');
    }
  }

  /**
   * Send an email – in preview mode, returns preview URL instead of sending.
   */
  async sendEmail(to: string, subject: string, html: string, text: string) {
    if (!this.transporter) {
      await this.initTransporter();
    }

    const mailOptions = {
      from: env.EMAIL_FROM || 'noreply@outreach.local',
      to,
      subject,
      text,
      html,
    };

    try {
      const info = await this.transporter!.sendMail(mailOptions);
      
      if (this.previewMode) {
        // Ethereal provides a preview URL
        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info({ previewUrl, to, subject }, 'Email preview generated');
        return { success: true, previewUrl, messageId: info.messageId };
      } else {
        logger.info({ messageId: info.messageId, to, subject }, 'Email sent');
        return { success: true, messageId: info.messageId };
      }
    } catch (error) {
      logger.error({ error, to, subject }, 'Email sending failed');
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance – preview mode on by default during development
export const emailService = new EmailService(env.NODE_ENV !== 'production');