import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { requireApiKey, ApiKeyRequest } from '../../middleware/apiKeyAuth.middleware';
import { logger } from '../../config/logger';

const router = Router();

// Public Unsubscribe Endpoint (Token-based, unauthenticated)
router.get('/recipients/:id/unsubscribe', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const recipient = await prisma.newsletterRecipient.findUnique({ where: { id } });
    if (!recipient) return res.status(404).send('Subscriber not found');

    await prisma.newsletterRecipient.update({
      where: { id },
      data: { status: 'UNSUBSCRIBED' },
    });

    // Remove from pending newsletter queue
    await prisma.newsletterQueueItem.deleteMany({
      where: { recipientId: id, status: 'PENDING' },
    });

    res.send(`
      <html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #18181b;">
        <h2>You have been unsubscribed</h2>
        <p>${recipient.email} will no longer receive broadcast newsletters from this sender.</p>
      </body></html>
    `);
  } catch (error) {
    res.status(500).send('Unsubscribe failed');
  }
});

// Guard all endpoints below with API Key auth
router.use(requireApiKey);

// POST /api/public/town-crier/recipients (Single subscriber addition)
router.post('/recipients', async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const { email, name } = req.body;

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  try {
    // Cross-check suppression blocklist
    const blocklist = await prisma.blocklist.findMany({ where: { userId } });
    const isBlocked = blocklist.some(b => {
      const pattern = b.pattern.replace(/^\*@?/, '').replace(/^@/, '');
      return cleanEmail === pattern || cleanEmail.endsWith('@' + pattern) || cleanEmail.endsWith('.' + pattern);
    });

    if (isBlocked) {
      return res.status(400).json({ error: 'This email is suppressed by workspace blocklist rules.' });
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
        source: 'api',
        status: 'SUBSCRIBED',
        unsubscribeToken: unsubToken,
      },
    });

    res.status(201).json(recipient);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to add newsletter recipient via API');
    res.status(500).json({ error: 'Failed to add recipient' });
  }
});

// GET /api/public/town-crier/recipients
router.get('/recipients', async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '50', 10);

  try {
    const [recipients, total] = await Promise.all([
      prisma.newsletterRecipient.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.newsletterRecipient.count({ where: { userId } }),
    ]);

    res.json({
      data: recipients,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

export default router;