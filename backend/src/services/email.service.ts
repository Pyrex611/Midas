import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import prisma from '../lib/prisma';
import { decrypt } from '../lib/encryption';

interface CachedSettings {
  settings: any;
  expires: number;
}

export class EmailService {
  private settingsCache: Map<string, CachedSettings> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCachedSettings(userId: string): any | null {
    const cached = this.settingsCache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return cached.settings;
    }
    this.settingsCache.delete(userId);
    return null;
  }

  private setCachedSettings(userId: string, settings: any) {
    this.settingsCache.set(userId, {
      settings,
      expires: Date.now() + this.CACHE_TTL,
    });
  }

  public clearCache(userId: string) {
    this.settingsCache.delete(userId);
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
    senderName?: string | null,
    inReplyTo?: string | null,
    userId?: string
  ) {
    let transporter: nodemailer.Transporter;
    let from: string;

    if (userId) {
      // Try cache first
      let userSettings = this.getCachedSettings(userId);
      if (!userSettings) {
        // Fetch from DB
        userSettings = await prisma.userSettings.findUnique({
          where: { userId },
        });
        if (userSettings) {
          this.setCachedSettings(userId, userSettings);
        }
      }

      if (userSettings && userSettings.smtpHost && userSettings.smtpUser && userSettings.smtpPass) {
        try {
          const smtpPass = decrypt(userSettings.smtpPass);
          transporter = nodemailer.createTransport({
            host: userSettings.smtpHost,
            port: userSettings.smtpPort || 587,
            secure: userSettings.smtpSecure ?? false,
            auth: {
              user: userSettings.smtpUser,
              pass: smtpPass,
            },
            logger: env.NODE_ENV === 'development',
            debug: env.NODE_ENV === 'development',
          });
          from = userSettings.emailFrom || env.EMAIL_FROM;
        } catch (error) {
          logger.error({ error, userId }, 'Failed to decrypt SMTP password, falling back to global');
          transporter = this.createGlobalTransporter();
          from = env.EMAIL_FROM;
        }
      } else {
        transporter = this.createGlobalTransporter();
        from = env.EMAIL_FROM;
      }
    } else {
      transporter = this.createGlobalTransporter();
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

    try {
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

  private createGlobalTransporter(): nodemailer.Transporter {
    if (env.EMAIL_SERVICE === 'ethereal') {
      throw new Error('Ethereal not supported with per‑user settings yet; use SMTP mode.');
    } else {
      return nodemailer.createTransport({
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
    }
  }
}

export const emailService = new EmailService();