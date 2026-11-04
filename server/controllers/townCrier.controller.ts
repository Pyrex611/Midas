import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateApiKey } from '../lib/apiKeys';
import { newsletterQueueService } from '../services/newsletterQueue.service';
import { logger } from '../config/logger';

// --- API Key Management ---

export const listApiKeys = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const keys = await prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch (error) { next(error); }
};

export const createApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { label, scopes } = req.body;

    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'A label is required for this API Key' });
    }

    const { plaintextKey, keyPrefix, keyHash } = generateApiKey();

    const created = await prisma.apiKey.create({
      data: {
        userId,
        label: label.trim(),
        keyPrefix,
        keyHash,
        scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : ['town_crier:write'],
      },
    });

    // Return the plaintext key ONCE
    res.status(201).json({
      id: created.id,
      label: created.label,
      keyPrefix: created.keyPrefix,
      plaintextKey,
      createdAt: created.createdAt,
      message: 'Save this API key safely. It will not be shown again.',
    });
  } catch (error) { next(error); }
};

export const revokeApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const key = await prisma.apiKey.findFirst({ where: { id, userId } });
    if (!key) return res.status(404).json({ error: 'API Key not found' });

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) { next(error); }
};

// --- Broadcast Management ---

export const listBroadcasts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const broadcasts = await prisma.newsletterBroadcast.findMany({
      where: { userId },
      include: {
        _count: {
          select: { queueItems: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      broadcasts.map(async (b) => {
        const [sent, failed, pending] = await Promise.all([
          prisma.newsletterQueueItem.count({ where: { broadcastId: b.id, status: 'SENT' } }),
          prisma.newsletterQueueItem.count({ where: { broadcastId: b.id, status: 'FAILED' } }),
          prisma.newsletterQueueItem.count({ where: { broadcastId: b.id, status: { in: ['PENDING', 'PROCESSING'] } } }),
        ]);

        return {
          ...b,
          metrics: { sent, failed, pending, total: b._count.queueItems },
        };
      })
    );

    res.json(enriched);
  } catch (error) { next(error); }
};

export const createBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { subject, body } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const broadcast = await prisma.newsletterBroadcast.create({
      data: {
        userId,
        subject: subject.trim(),
        body: body.trim(),
        status: 'DRAFT',
      },
    });

    res.status(201).json(broadcast);
  } catch (error) { next(error); }
};

/**
 * POST /api/town-crier/broadcasts/:id/queue
 * Enqueues broadcast into NewsletterQueueItem. NEVER sends directly in bulk.
 */
export const queueBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await newsletterQueueService.queueBroadcast(id, userId);
    res.json({
      success: true,
      message: `Broadcast queued successfully with ${result.queuedCount} recipient(s). Sends will dispatch via bounded queue sweeps.`,
      queuedCount: result.queuedCount,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to queue newsletter broadcast');
    res.status(400).json({ error: error.message || 'Failed to queue broadcast' });
  }
};

export const triggerNewsletterSweep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await newsletterQueueService.processNewsletterQueue();
    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};