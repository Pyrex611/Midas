import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'URGENT' | 'INBOUND_REPLY';
  link?: string;
  metadata?: any;
}

export class NotificationService {
  async create(params: CreateNotificationParams) {
    try {
      const notif = await prisma.notification.create({
        data: {
          userId: params.userId,
          title: params.title.trim(),
          message: params.message.trim(),
          type: params.type || 'INFO',
          link: params.link || null,
          metadata: params.metadata || null,
        },
      });

      logger.info({ notificationId: notif.id, userId: params.userId, type: notif.type }, '[NOTIFICATION] Dispatched');
      return notif;
    } catch (error: any) {
      logger.error({ error: error.message, userId: params.userId }, 'Failed to persist notification');
      return null;
    }
  }

  async list(userId: string, limit: number = 20) {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return { notifications, unreadCount };
  }

  async markAsRead(userId: string, id: string) {
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}

export const notificationService = new NotificationService();