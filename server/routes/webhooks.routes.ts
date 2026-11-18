import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Webhook } from 'svix';
import prisma from '../lib/prisma';
import { env } from '../config/env';
import { webhooksService } from '../services/webhooks.service';
import { dodoService } from '../services/billing/dodo.service';
import { authEmailHookService } from '../services/authEmailHook.service';
import { logger } from '../config/logger';

const router = Router();
const upload = multer();

function safeWaitUntil(promise: Promise<any>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vercel = require('@vercel/functions');
    if (typeof vercel.waitUntil === 'function') {
      vercel.waitUntil(promise);
      return;
    }
  } catch {}

  promise.catch((err) => {
    logger.error({ err: err?.message || err }, '[BACKGROUND TASK ERROR]');
  });
}

// 1. Mailgun Deliverability Events Webhook
router.post('/mailgun', async (req: Request, res: Response) => {
  try {
    const { signature } = req.body;
    if (!signature) return res.status(401).send('Missing signature');

    const isValid = webhooksService.verifyMailgunSignature(
      signature.timestamp,
      signature.token,
      signature.signature
    );

    if (!isValid) return res.status(403).send('Invalid Signature');

    safeWaitUntil(
      webhooksService.processDeliverabilityEvent(req.body).catch((err) => {
        logger.error({ err }, 'Deliverability event background processing error');
      })
    );

    res.status(200).send('OK');
  } catch (error) {
    logger.error({ error }, 'Mailgun event webhook error');
    res.status(500).send('Internal Server Error');
  }
});

// 2. Mailgun Inbound Parse Webhook
router.post('/mailgun/inbound', upload.none(), async (req: Request, res: Response) => {
  try {
    const { timestamp, token, signature } = req.body;
    if (!signature) return res.status(401).send('Missing signature');

    const isValid = webhooksService.verifyMailgunSignature(timestamp, token, signature);
    if (!isValid) return res.status(403).send('Invalid Signature');

    safeWaitUntil(
      webhooksService.processInboundEmail(req.body).catch((err) => {
        logger.error({ err }, 'Inbound reply processing error');
      })
    );

    res.status(200).send('OK');
  } catch (error) {
    logger.error({ error }, 'Mailgun inbound webhook error');
    res.status(500).send('Internal Server Error');
  }
});

// 3. Resend Svix Webhook (Deliverability + email.received Inbound Replies)
router.post('/resend', async (req: Request, res: Response) => {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('RESEND_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Resend webhook secret not configured' });
  }

  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  const rawPayload = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
  try {
    const wh = new Webhook(secret);
    wh.verify(rawPayload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Resend Svix signature verification failed');
    return res.status(401).json({ error: 'Invalid Resend webhook signature' });
  }

  safeWaitUntil(
    webhooksService.processResendWebhook(req.body).catch((err) => {
      logger.error({ err: err?.message }, '[RESEND] Background webhook error');
    })
  );

  res.status(200).json({ received: true });
});

// 4. Generic Custom Inbound Webhook
router.post('/inbound/custom/:domainId', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;
    const providedToken = (req.headers['x-midas-inbound-token'] as string) || (req.query.token as string);

    if (!webhooksService.verifyCustomInboundToken(domainId, providedToken)) {
      return res.status(401).json({ error: 'Invalid inbound token' });
    }

    safeWaitUntil(
      webhooksService.processInboundEmail({
        'Message-Id': req.body.messageId || req.body['Message-Id'],
        'In-Reply-To': req.body.inReplyTo || req.body['In-Reply-To'],
        References: req.body.references || req.body.References,
        from: req.body.from,
        to: req.body.to,
        subject: req.body.subject,
        'stripped-text': req.body.text || req.body.body || '',
        'stripped-html': req.body.html || '',
        timestamp: req.body.timestamp,
      })
    );

    res.status(200).json({ received: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Custom inbound error' });
  }
});

// 5. Dodo Payments Standard Webhooks Receiver
router.post('/dodo', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = dodoService.verifyWebhookSignature(rawBody, {
      webhookId: req.headers['webhook-id'] as string | undefined,
      webhookTimestamp: req.headers['webhook-timestamp'] as string | undefined,
      webhookSignature: req.headers['webhook-signature'] as string | undefined,
    });

    if (!isValid) {
      logger.warn('[DODO] Rejected webhook due to invalid Standard Webhooks signature');
      return res.status(401).json({ error: 'Invalid Dodo webhook signature' });
    }

    safeWaitUntil(
      dodoService.processWebhook(req.body).catch((err) => {
        logger.error({ err: err?.message }, '[DODO] Background webhook processing error');
      })
    );

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error }, 'Dodo Payments webhook error');
    res.status(500).send('Internal Server Error');
  }
});

// 6. Supabase "Send Email" HTTP Auth Hook (Must respond < 5s)
router.post('/supabase/auth-email', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = authEmailHookService.verifySignature(rawBody, {
      'webhook-id': req.headers['webhook-id'] as string | undefined,
      'webhook-timestamp': req.headers['webhook-timestamp'] as string | undefined,
      'webhook-signature': req.headers['webhook-signature'] as string | undefined,
    });

    if (!isValid) {
      logger.warn('[AUTH-HOOK] Invalid Supabase Send Email hook signature');
      return res.status(401).json({
        error: { http_code: 401, message: 'Invalid Standard Webhooks signature' },
      });
    }

    await authEmailHookService.processSendEmailHook(req.body);
    res.status(200).json({});
  } catch (error: any) {
    logger.error({ error: error?.message }, '[AUTH-HOOK] Failed to dispatch Supabase auth email');
    res.status(500).json({
      error: { http_code: 500, message: error?.message || 'Failed to send authentication email' },
    });
  }
});

// 7. Clerk User Synchronization Webhook
router.post('/clerk', async (req: Request, res: Response) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('CLERK_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Webhook configuration error' });
  }

  const headers = req.headers;
  const svix_id = headers['svix-id'] as string;
  const svix_timestamp = headers['svix-timestamp'] as string;
  const svix_signature = headers['svix-signature'] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  const payload = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
  const wh = new Webhook(webhookSecret);
  let evt: any;

  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any;
  } catch (err: any) {
    logger.error({ err }, 'Clerk webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const eventType = evt.type;

  try {
    if (eventType === 'user.created' || eventType === 'user.updated') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;
      const email = email_addresses?.[0]?.email_address;
      const name = `${first_name || ''} ${last_name || ''}`.trim() || email?.split('@')[0];

      if (email) {
        await prisma.user.upsert({
          where: { email },
          update: { clerkId, name },
          create: { clerkId, email, name },
        });
      }
    } else if (eventType === 'user.deleted') {
      const { id: clerkId } = evt.data;
      await prisma.user.deleteMany({ where: { clerkId } });
    }

    res.json({ success: true });
  } catch (dbErr: any) {
    logger.error({ dbErr }, 'Clerk webhook database sync failed');
    res.status(500).json({ error: 'Database syncing failed' });
  }
});

export default router;