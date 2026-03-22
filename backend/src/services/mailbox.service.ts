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
   * Selects an available mailbox from the SHARED campaign pool.
   * IMPROVED: Now iterates through the pool to find a mailbox that is 
   * NOT on cooldown, maximizing campaign throughput.
   */
  async selectMailboxForCampaign(campaignId: string, preferredMailboxId?: string | null) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        mailboxLinks: {
          include: { mailbox: true },
          where: { mailbox: { isActive: true, status: 'HEALTHY' } }
        },
      },
    });

    if (!campaign || campaign.mailboxLinks.length === 0) return null;

    const pool = campaign.mailboxLinks.map(link => link.mailbox);

    // 1. Thread Integrity (Follow-ups)
    if (preferredMailboxId) {
      const preferred = pool.find(m => m.id === preferredMailboxId);
      if (preferred) {
        // We still check if the preferred mailbox is within its specific interval
        const stats = await this.getMailboxAvailability(preferred);
        if (stats.canSend) return { mailbox: preferred, index: -1 };
        return null; // Must wait for the specific mailbox for follow-ups
      }
    }

    // 2. High-Throughput Round-Robin
    // We try each mailbox in the pool starting from the last index
    for (let i = 0; i < pool.length; i++) {
      const nextIndex = (campaign.lastMailboxIndex + i) % pool.length;
      const candidate = pool[nextIndex];
      
      const stats = await this.getMailboxAvailability(candidate);

      if (stats.canSend) {
        // We found a mailbox ready to go!
        // Update the campaign index to the NEXT one for the next lead
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { lastMailboxIndex: (nextIndex + 1) % pool.length },
        });
        return { mailbox: candidate, index: nextIndex };
      }
    }

    // No mailboxes in the pool are ready yet (all on interval cooldown)
    return null;
  }

  /**
   * Helper to check if a mailbox has met its daily limit or interval cooldown
   */
  private async getMailboxAvailability(mailbox: any) {
    const now = new Date();
    
    // Check Daily Limit
    if (mailbox.sentCount >= mailbox.sendLimit) {
      return { canSend: false };
    }

    // Check Interval (e.g. 50/day = 1 email every 28.8 minutes)
    if (mailbox.lastSend) {
      const periodMinutes = mailbox.sendPeriod === 'day' ? 1440 : 10080;
      const intervalMs = (periodMinutes * 60 * 1000) / mailbox.sendLimit;
      const timeSinceLast = now.getTime() - new Date(mailbox.lastSend).getTime();
      
      if (timeSinceLast < intervalMs) {
        return { canSend: false };
      }
    }

    return { canSend: true };
  }
}

export const mailboxService = new MailboxService();