import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { webhookDispatchService } from '../services/webhookDispatch.service';

export const listSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: { userId },
      include: {
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(subscriptions);
  } catch (error) {
    next(error);
  }
};

export const createSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { targetUrl, events } = req.body;

    if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl.trim())) {
      return res.status(400).json({ error: 'A valid HTTPS targetUrl is required' });
    }

    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
    const validatedEvents = Array.isArray(events) && events.length > 0 ? events : ['*'];

    const sub = await prisma.webhookSubscription.create({
      data: {
        userId,
        targetUrl: targetUrl.trim(),
        secret,
        events: validatedEvents,
      },
    });

    res.status(201).json(sub);
  } catch (error) {
    next(error);
  }
};

export const deleteSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const sub = await prisma.webhookSubscription.findFirst({ where: { id, userId } });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    await prisma.webhookSubscription.delete({ where: { id } });
    res.json({ success: true, message: 'Webhook endpoint removed' });
  } catch (error) {
    next(error);
  }
};

export const testSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const delivery = await webhookDispatchService.testPing(id, userId);
    res.json({ success: true, delivery });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to ping webhook endpoint' });
  }
};

export const listDeliveries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const sub = await prisma.webhookSubscription.findFirst({ where: { id, userId } });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    res.json(deliveries);
  } catch (error) {
    next(error);
  }
};