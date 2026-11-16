import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { assertSafePublicUrl } from '../lib/ssrfGuard';
import { webhookDispatchService } from '../services/webhookDispatch.service';

export const listSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subs = await prisma.webhookSubscription.findMany({
      where: { userId: req.user!.id },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(subs);
  } catch (error) {
    next(error);
  }
};

export const createSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetUrl, events } = req.body;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ error: 'targetUrl is required' });
    }

    const parsedUrl = await assertSafePublicUrl(targetUrl);

    const existingCount = await prisma.webhookSubscription.count({ where: { userId } });
    if (existingCount >= 10) {
      return res.status(400).json({ error: 'Maximum of 10 webhook subscriptions per workspace reached' });
    }

    const validEvents =
      Array.isArray(events) && events.length > 0
        ? events.map((e) => String(e).trim()).filter(Boolean)
        : ['*'];

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const created = await prisma.webhookSubscription.create({
      data: {
        userId,
        targetUrl: parsedUrl.toString(),
        secret,
        events: validEvents,
        isActive: true,
      },
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to register webhook endpoint' });
  }
};

export const deleteSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.webhookSubscription.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const testSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const sub = await prisma.webhookSubscription.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!sub) return res.status(404).json({ error: 'Webhook subscription not found' });

    const delivery = await webhookDispatchService.deliverToSubscription(sub, 'webhook.test', {
      message: 'Midas CRM webhook ping verification',
      subscriptionId: sub.id,
      pingedAt: new Date().toISOString(),
    });

    res.json({ success: delivery.status === 'DELIVERED', delivery });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Webhook test ping failed' });
  }
};

export const listDeliveries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.webhookSubscription.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: { id: true },
    });
    if (!sub) return res.status(404).json({ error: 'Webhook subscription not found' });

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    res.json(deliveries);
  } catch (error) {
    next(error);
  }
};