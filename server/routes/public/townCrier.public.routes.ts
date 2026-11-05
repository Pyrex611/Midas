import { Router, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import Papa from 'papaparse';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { requireApiKey, ApiKeyRequest } from '../../middleware/apiKeyAuth.middleware';
import { reconcileCampaignQueue } from '../../controllers/campaign/campaign.queue.controller';
import { logger } from '../../config/logger';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

router.use(cors({ origin: true, credentials: true }));

/**
 * GET /api/public/town-crier/widget.js
 * Universal Drop-in Newsletter Widget Script:
 * Works in Next.js, Vite, WordPress, Webflow, Squarespace, and static HTML.
 */
router.get('/widget.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const script = `
(function() {
  window.TownCrier = window.TownCrier || {};

  window.TownCrier.subscribe = async function(options) {
    if (!options || !options.email) throw new Error('Email is required');
    var endpoint = options.endpoint || (window.location.origin + '/api/public/town-crier/subscribe');
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (options.apiKey || '')
      },
      body: JSON.stringify({
        email: options.email,
        name: options.name || undefined,
        tags: options.tags || ['website_widget'],
        campaignId: options.campaignId || undefined,
        metadata: options.metadata || undefined
      })
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) throw new Error(data.error || 'Subscription failed');
    return data;
  };

  // Auto-init forms with data-town-crier-key
  function initAutoWidgets() {
    var forms = document.querySelectorAll('form[data-town-crier-key]');
    forms.forEach(function(form) {
      if (form.getAttribute('data-tc-initialized')) return;
      form.setAttribute('data-tc-initialized', 'true');

      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var key = form.getAttribute('data-town-crier-key');
        var campaignId = form.getAttribute('data-campaign-id') || undefined;
        var emailInput = form.querySelector('input[type="email"]') || form.querySelector('input[name="email"]');
        var nameInput = form.querySelector('input[name="name"]');
        var submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');

        if (!emailInput || !emailInput.value) return;

        var originalText = submitBtn ? submitBtn.innerText : '';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Subscribing...'; }

        try {
          await window.TownCrier.subscribe({
            apiKey: key,
            email: emailInput.value,
            name: nameInput ? nameInput.value : undefined,
            campaignId: campaignId,
            tags: ['embed_form']
          });
          form.reset();
          var successMsg = form.querySelector('.tc-success-message');
          if (successMsg) {
            successMsg.style.display = 'block';
          } else {
            alert('Thank you for subscribing!');
          }
        } catch (err) {
          alert(err.message || 'Subscription failed. Please try again.');
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalText; }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoWidgets);
  } else {
    initAutoWidgets();
  }
})();
  `.trim();

  res.send(script);
});

async function executeUnsubscribe(identifier: string, isToken: boolean, res: Response) {
  try {
    const recipient = await prisma.newsletterRecipient.findFirst({
      where: isToken ? { unsubscribeToken: identifier } : { OR: [{ id: identifier }, { unsubscribeToken: identifier }] },
    });

    if (!recipient) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #18181b;">
          <h2>Unsubscribe Link Expired</h2>
          <p>We could not find a subscriber associated with this link.</p>
        </body></html>
      `);
    }

    if (recipient.status !== 'UNSUBSCRIBED') {
      await prisma.newsletterRecipient.update({
        where: { id: recipient.id },
        data: { status: 'UNSUBSCRIBED' },
      });

      await prisma.newsletterQueueItem.deleteMany({
        where: { recipientId: recipient.id, status: 'PENDING' },
      });
      logger.info({ recipientId: recipient.id, email: recipient.email }, 'Town Crier subscriber unsubscribed');
    }

    res.send(`
      <!DOCTYPE html>
      <html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #18181b;">
        <h2>You Have Been Unsubscribed</h2>
        <p>${recipient.email} will no longer receive broadcast newsletters from this sender.</p>
      </body></html>
    `);
  } catch (error) {
    logger.error({ error }, 'Town Crier unsubscribe failure');
    res.status(500).send('Unsubscribe failed. Please try again later.');
  }
}

// 1. Token-Based Unsubscribe (Privacy-Preserving)
router.get('/recipients/unsubscribe/:token', async (req: Request, res: Response) => {
  await executeUnsubscribe(req.params.token, true, res);
});

// 2. Legacy ID-Based Unsubscribe (Backwards-Compatible Fallback)
router.get('/recipients/:id/unsubscribe', async (req: Request, res: Response) => {
  await executeUnsubscribe(req.params.id, false, res);
});

// RFC-8058 One-Click POST Support
router.post('/recipients/unsubscribe/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const recipient = await prisma.newsletterRecipient.findFirst({
      where: { unsubscribeToken: token },
    });
    if (!recipient) return res.status(404).send('Not Found');

    await prisma.newsletterRecipient.update({
      where: { id: recipient.id },
      data: { status: 'UNSUBSCRIBED' },
    });
    await prisma.newsletterQueueItem.deleteMany({
      where: { recipientId: recipient.id, status: 'PENDING' },
    });
    res.status(200).send('OK');
  } catch {
    res.status(500).send('Error');
  }
});

// Guard all endpoints below with API Key auth
router.use(requireApiKey);

/**
 * POST /api/public/town-crier/subscribe
 * Universal Ingestion Gateway: accepts single subscriber JSON or bulk array.
 * Supports direct campaign auto-enrollment if campaignId is passed!
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const payload = req.body;

  try {
    const blocklist = await prisma.blocklist.findMany({ where: { userId } });
    const isSuppressed = (email: string) => blocklist.some(b => {
      const p = b.pattern.replace(/^\*@?/, '').replace(/^@/, '');
      return email === p || email.endsWith('@' + p) || email.endsWith('.' + p);
    });

    if (Array.isArray(payload.subscribers)) {
      const validSubscribers = payload.subscribers
        .map((s: any) => ({
          email: String(s.email || '').trim().toLowerCase(),
          name: s.name ? String(s.name).trim() : null,
          tags: Array.isArray(s.tags) ? s.tags.map((t: any) => String(t).trim()) : ['api_bulk'],
          userId,
          source: 'api_bulk',
          status: 'SUBSCRIBED',
          unsubscribeToken: crypto.randomBytes(16).toString('hex'),
        }))
        .filter((s: any) => s.email && s.email.includes('@') && !isSuppressed(s.email));

      let insertedCount = 0;
      const CHUNK = 500;
      for (let i = 0; i < validSubscribers.length; i += CHUNK) {
        const batch = validSubscribers.slice(i, i + CHUNK);
        const r = await prisma.newsletterRecipient.createMany({
          data: batch,
          skipDuplicates: true,
        });
        insertedCount += r.count;
      }

      return res.status(201).json({ success: true, processed: payload.subscribers.length, inserted: insertedCount });
    }

    const cleanEmail = (payload.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (isSuppressed(cleanEmail)) {
      return res.status(400).json({ error: 'This email is suppressed by workspace blocklist rules.' });
    }

    const unsubToken = crypto.randomBytes(16).toString('hex');
    const cleanTags = Array.isArray(payload.tags) ? payload.tags.map((t: any) => String(t).trim()) : ['website_form'];

    const recipient = await prisma.newsletterRecipient.upsert({
      where: {
        userId_email: {
          userId,
          email: cleanEmail,
        },
      },
      update: {
        name: payload.name ? String(payload.name).trim() : undefined,
        status: 'SUBSCRIBED',
        tags: cleanTags,
        metadata: payload.metadata || undefined,
      },
      create: {
        userId,
        email: cleanEmail,
        name: payload.name ? String(payload.name).trim() : null,
        source: 'website_form',
        status: 'SUBSCRIBED',
        tags: cleanTags,
        metadata: payload.metadata || null,
        unsubscribeToken: unsubToken,
      },
    });

    if (payload.campaignId && typeof payload.campaignId === 'string') {
      const campaign = await prisma.campaign.findFirst({
        where: { id: payload.campaignId.trim(), userId },
      });
      if (campaign) {
        await prisma.lead.upsert({
          where: { userId_email: { userId, email: cleanEmail } },
          update: { campaignId: campaign.id, outreachStatus: 'PENDING' },
          create: {
            userId,
            email: cleanEmail,
            name: payload.name ? String(payload.name).trim() : cleanEmail.split('@')[0],
            campaignId: campaign.id,
            outreachStatus: 'PENDING',
          },
        });
        reconcileCampaignQueue(campaign.id, userId).catch(() => {});
      }
    }

    res.status(201).json({ success: true, subscriber: recipient });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to ingest newsletter subscriber');
    res.status(500).json({ error: 'Failed to process subscription' });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const status = req.query.status as string || 'SUBSCRIBED';

  try {
    const subscribers = await prisma.newsletterRecipient.findMany({
      where: { userId, ...(status !== 'all' ? { status } : {}) },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        tags: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ total: subscribers.length, subscribers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export subscribers' });
  }
});

router.post('/recipients/import', upload.single('file'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;

  if (!req.file) {
    return res.status(400).json({ error: 'A CSV file is required' });
  }

  try {
    const csvText = req.file.buffer.toString('utf8');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];

    const blocklist = await prisma.blocklist.findMany({ where: { userId } });
    const validRecipients: any[] = [];

    for (const row of rows) {
      const keys = Object.keys(row);
      const emailKey = keys.find(k => /email/i.test(k));
      const nameKey = keys.find(k => /^(full ?name|name)$/i.test(k));

      const email = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
      const name = nameKey ? String(row[nameKey] || '').trim() : null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

      const isBlocked = blocklist.some(b => {
        const pattern = b.pattern.replace(/^\*@?/, '').replace(/^@/, '');
        return email === pattern || email.endsWith('@' + pattern) || email.endsWith('.' + pattern);
      });
      if (isBlocked) continue;

      validRecipients.push({
        email,
        name: name || null,
        userId,
        source: 'api_import',
        status: 'SUBSCRIBED',
        tags: ['csv_import'],
        unsubscribeToken: crypto.randomBytes(16).toString('hex'),
      });
    }

    let insertedCount = 0;
    const CHUNK = 500;
    for (let i = 0; i < validRecipients.length; i += CHUNK) {
      const batch = validRecipients.slice(i, i + CHUNK);
      const r = await prisma.newsletterRecipient.createMany({
        data: batch,
        skipDuplicates: true,
      });
      insertedCount += r.count;
    }

    res.status(201).json({ success: true, processedRows: rows.length, insertedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

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