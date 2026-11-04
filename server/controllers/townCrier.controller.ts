import { Response, NextFunction } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateApiKey } from '../lib/apiKeys';
import { newsletterQueueService } from '../services/newsletterQueue.service';
import { logger } from '../config/logger';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

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

    if (!label || typeof label !== 'string' || !label.trim()) {
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

// --- Recipient Management (UI Authed) ---

export const listRecipients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    const status = req.query.status as string;

    const where: any = { userId };
    if (status && status !== 'all') where.status = status;

    const [recipients, total] = await Promise.all([
      prisma.newsletterRecipient.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.newsletterRecipient.count({ where }),
    ]);

    res.json({
      data: recipients,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) { next(error); }
};

export const addRecipient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { email, name } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const unsubToken = crypto.randomBytes(16).toString('hex');

    const recipient = await prisma.newsletterRecipient.upsert({
      where: {
        userId_email: {
          userId,
          email: cleanEmail,
        },
      },
      update: {
        name: name ? String(name).trim() : undefined,
        status: 'SUBSCRIBED',
      },
      create: {
        userId,
        email: cleanEmail,
        name: name ? String(name).trim() : null,
        source: 'ui',
        status: 'SUBSCRIBED',
        unsubscribeToken: unsubToken,
      },
    });

    res.status(201).json(recipient);
  } catch (error) { next(error); }
};

export const importRecipients = [
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
      const userId = req.user!.id;
      const csvText = req.file.buffer.toString('utf8');

      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const rows = parsed.data as any[];

      const blocklist = await prisma.blocklist.findMany({ where: { userId } });

      const validRecipients: { email: string; name: string | null; userId: string; source: string; status: string; unsubscribeToken: string }[] = [];

      for (const row of rows) {
        const keys = Object.keys(row);
        const emailKey = keys.find(k => /email/i.test(k));
        const nameKey = keys.find(k => /^(full ?name|name)$/i.test(k));

        const email = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
        const name = nameKey ? String(row[nameKey] || '').trim() : null;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

        // Check suppression blocklist
        const isBlocked = blocklist.some(b => {
          const pattern = b.pattern.replace(/^\*@?/, '').replace(/^@/, '');
          return email === pattern || email.endsWith('@' + pattern) || email.endsWith('.' + pattern);
        });
        if (isBlocked) continue;

        validRecipients.push({
          email,
          name: name || null,
          userId,
          source: 'import',
          status: 'SUBSCRIBED',
          unsubscribeToken: crypto.randomBytes(16).toString('hex'),
        });
      }

      let insertedCount = 0;
      const CHUNK = 500;
      for (let i = 0; i < validRecipients.length; i += CHUNK) {
        const batch = validRecipients.slice(i, i + CHUNK);
        const res = await prisma.newsletterRecipient.createMany({
          data: batch,
          skipDuplicates: true,
        });
        insertedCount += res.count;
      }

      res.status(201).json({ success: true, totalRows: rows.length, importedCount: insertedCount });
    } catch (error) { next(error); }
  },
];

export const deleteRecipient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await prisma.newsletterRecipient.deleteMany({
      where: { id, userId },
    });

    res.json({ success: true });
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

export const deleteBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await prisma.newsletterBroadcast.deleteMany({
      where: { id, userId },
    });

    res.json({ success: true });
  } catch (error) { next(error); }
};

export const triggerNewsletterSweep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await newsletterQueueService.processNewsletterQueue();
    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};