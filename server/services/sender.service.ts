import prisma from '../lib/prisma';

export class SenderService {
  /**
   * Evaluates whether a sender has crossed into a new calendar day (UTC)
   * relative to its lastSentReset timestamp. If so, atomically resets
   * sentCountToday to 0, advances warmupDay by 1, and increases dailyLimit by 5.
   * Returns the fresh, updated sender record.
   */
  async ensureSenderDailyReset(senderId: string): Promise<any> {
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
      include: { domain: true },
    });
    if (!sender) return null;

    const today = new Date().toISOString().split('T')[0];
    const lastReset = new Date(sender.lastSentReset).toISOString().split('T')[0];

    if (today !== lastReset) {
      return prisma.sender.update({
        where: { id: sender.id },
        data: {
          sentCountToday: 0,
          lastSentReset: new Date(),
          warmupDay: { increment: 1 },
          dailyLimit: { increment: 5 },
        },
        include: { domain: true },
      });
    }

    return sender;
  }

  async createSender(
    userId: string,
    domainId: string,
    localPart: string,
    displayName?: string | null,
    dailyLimit: number = 20
  ) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');
    if (!domain.sendTestPassedAt) {
      throw new Error("This domain hasn't passed its send test yet — run the connectivity test before adding senders.");
    }

    const clean = localPart.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
    if (!clean) throw new Error('Invalid sender address');

    return prisma.sender.create({
      data: {
        domainId,
        userId,
        localPart: clean,
        displayName: displayName || null,
        dailyLimit,
      },
      include: { domain: true },
    });
  }

  async listSendersForDomain(userId: string, domainId: string) {
    return prisma.sender.findMany({
      where: { domainId, userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Every sender the user has, across all their domains — used to populate a campaign's sender picker. */
  async listAllSendersForUser(userId: string) {
    return prisma.sender.findMany({
      where: { userId },
      include: { domain: { select: { domainName: true, status: true, sendTestPassedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateSender(
    userId: string,
    senderId: string,
    data: { displayName?: string; dailyLimit?: number; status?: 'active' | 'paused' }
  ) {
    const result = await prisma.sender.updateMany({
      where: { id: senderId, userId },
      data,
    });
    if (result.count === 0) throw new Error('Sender not found');
    return prisma.sender.findUnique({ where: { id: senderId } });
  }

  async deleteSender(userId: string, senderId: string) {
    const result = await prisma.sender.deleteMany({ where: { id: senderId, userId } });
    if (result.count === 0) throw new Error('Sender not found');
  }
}

export const senderService = new SenderService();