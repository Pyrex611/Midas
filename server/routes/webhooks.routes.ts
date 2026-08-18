import { Router } from 'express';
import multer from 'multer';
import { Webhook } from 'svix';
import prisma from '../lib/prisma';
import { webhooksService } from '../services/webhooks.service';
import { logger } from '../config/logger';

const router = Router();
const upload = multer();

// 1. Mailgun Deliverability Events Webhook (Delivered, Opened, Clicked, Bounced, Complained)
router.post('/mailgun', async (req, res) => {
  try {
    const { signature } = req.body;
    if (!signature) return res.status(401).send('Missing signature');

    const isValid = webhooksService.verifyMailgunSignature(
      signature.timestamp,
      signature.token,
      signature.signature
    );

    if (!isValid) return res.status(403).send('Invalid Signature');

    webhooksService.processDeliverabilityEvent(req.body).catch(err => {
      logger.error({ err }, 'Deliverability event background processing error');
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error({ error }, 'Mailgun event webhook error');
    res.status(500).send('Internal Server Error');
  }
});

// 2. Mailgun Inbound Parse Webhook (Inbound Prospect Replies)
router.post('/mailgun/inbound', upload.none(), async (req, res) => {
  try {
    const { timestamp, token, signature } = req.body;
    if (!signature) return res.status(401).send('Missing signature');

    const isValid = webhooksService.verifyMailgunSignature(timestamp, token, signature);
    if (!isValid) return res.status(403).send('Invalid Signature');

    webhooksService.processInboundEmail(req.body).catch(err => {
      logger.error({ err }, 'Inbound reply processing error');
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error({ error }, 'Mailgun inbound webhook error');
    res.status(500).send('Internal Server Error');
  }
});

// 3. Clerk User Synchronization Webhook
router.post('/clerk', async (req, res) => {
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

  const payload = JSON.stringify(req.body);
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
          create: {
            clerkId,
            email,
            name,
          },
        });
        logger.info({ clerkId, email }, 'Clerk user synced successfully');
      }
    } else if (eventType === 'user.deleted') {
      const { id: clerkId } = evt.data;
      await prisma.user.deleteMany({
        where: { clerkId },
      });
      logger.info({ clerkId }, 'Clerk user deleted from database');
    }

    res.json({ success: true });
  } catch (dbErr: any) {
    logger.error({ dbErr }, 'Clerk webhook database sync failed');
    res.status(500).json({ error: 'Database syncing failed' });
  }
});

export default router;