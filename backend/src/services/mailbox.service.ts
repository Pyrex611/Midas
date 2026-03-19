import prisma from '../lib/prisma';
import { encrypt, decrypt } from '../lib/encryption';
import { logger } from '../config/logger';

export class MailboxService {
  /**
   * Create a new mailbox for a user.
   */
  async createMailbox(userId: string, data: any) {
    const { smtpPass, imapPass, ...rest } = data;

    const encryptedData: any = { ...rest };
    if (smtpPass) encryptedData.smtpPass = encrypt(smtpPass);
    if (imapPass) encryptedData.imapPass = encrypt(imapPass);

    if (data.isPrimary) {
      await prisma.mailbox.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const mailbox = await prisma.mailbox.create({
      data: {
        userId,
        ...encryptedData,
      },
    });

    logger.info({ mailboxId: mailbox.id, userId }, 'Mailbox created');
    return mailbox;
  }

  /**
   * Get all mailboxes for a user.
   * Explicitly mapping fields to ensure frontend compatibility and analytics visibility.
   */
  async getUserMailboxes(userId: string) {
    const mailboxes = await prisma.mailbox.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return mailboxes.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      senderName: m.senderName,
      // Analytics & Health (Phase 4.5c)
      status: m.status || 'HEALTHY',
      totalSent: m.totalSent ?? 0,
      bounceCount: m.bounceCount ?? 0,
      replyCount: m.replyCount ?? 0,
      lastError: m.lastError,
      // Limits & Quotas
      sentCount: m.sentCount ?? 0,
      sendLimit: m.sendLimit ?? 50,
      sendPeriod: m.sendPeriod || 'day',
      lastSend: m.lastSend,
      // Settings
      isPrimary: m.isPrimary || false,
      smtpPass: m.smtpPass ? '********' : null,
      imapPass: m.imapPass ? '********' : null,
    }));
  }

  /**
   * Get a decrypted mailbox for sending.
   */
  async getMailboxForSending(id: string) {
    const mailbox = await prisma.mailbox.findUnique({ where: { id } });
    if (!mailbox) throw new Error('Mailbox not found');
    
    return {
      ...mailbox,
      smtpPass: mailbox.smtpPass ? decrypt(mailbox.smtpPass) : null,
      imapPass: mailbox.imapPass ? decrypt(mailbox.imapPass) : null,
    };
  }

  /**
   * Update a mailbox.
   */
  async updateMailbox(userId: string, id: string, data: any) {
    const existing = await prisma.mailbox.findFirst({ where: { id, userId } });
    if (!existing) throw new Error('Mailbox not found or not owned by user');

    const { smtpPass, imapPass, ...rest } = data;
    const encryptedData: any = { ...rest };
    
    if (smtpPass && smtpPass !== '********') encryptedData.smtpPass = encrypt(smtpPass);
    if (imapPass && imapPass !== '********') encryptedData.imapPass = encrypt(imapPass);

    if (data.isPrimary) {
      await prisma.mailbox.updateMany({
        where: { userId, isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }

    return prisma.mailbox.update({
      where: { id },
      data: encryptedData,
    });
  }

  /**
   * Soft delete a mailbox.
   */
  async deleteMailbox(userId: string, id: string) {
    const existing = await prisma.mailbox.findFirst({ where: { id, userId } });
    if (!existing) throw new Error('Mailbox not found');
    
    await prisma.mailbox.update({
      where: { id },
      data: { isActive: false, isPrimary: false },
    });
    
    logger.info({ mailboxId: id, userId }, 'Mailbox deactivated');
  }

  /**
   * Round-robin selection of a mailbox for a campaign.
   */
  async selectMailboxForCampaign(campaignId: string, preferredMailboxId?: string | null) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        mailboxLinks: {
          include: { mailbox: true },
        },
      },
    });

    if (!campaign || campaign.mailboxLinks.length === 0) return null;

    const mailboxes = campaign.mailboxLinks
      .map(link => link.mailbox)
      .filter(m => m.isActive);

    if (mailboxes.length === 0) return null;

    // 1. Check Preferred
    if (preferredMailboxId) {
      const preferred = mailboxes.find(m => m.id === preferredMailboxId);
      if (preferred) return { mailbox: preferred, index: -1 };
    }

    // 2. Round-Robin
    const index = campaign.lastMailboxIndex % mailboxes.length;
    const selected = mailboxes[index];

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { lastMailboxIndex: (index + 1) % mailboxes.length },
    });

    return { mailbox: selected, index };
  }
}

export const mailboxService = new MailboxService();