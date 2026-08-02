import { Router } from 'express';
import { Webhook } from 'svix';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

const router = Router();

router.post('/clerk', async (req, res) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('CLERK_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook configuration error' });
  }

  const headers = req.headers;
  const svix_id = headers['svix-id'] as string;
  const svix_timestamp = headers['svix-timestamp'] as string;
  const svix_signature = headers['svix-signature'] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  // Parse raw body payload as string for verification
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
    logger.error({ err }, 'Webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const eventType = evt.type;

  try {
    if (eventType === 'user.created' || eventType === 'user.updated') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;
      const email = email_addresses?.[0]?.email_address;
      const name = `${first_name || ''} ${last_name || ''}`.trim() || email.split('@')[0];

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
        logger.info({ clerkId, email }, 'Clerk User synced successfully to DB');
      }
    } else if (eventType === 'user.deleted') {
      const { id: clerkId } = evt.data;
      await prisma.user.deleteMany({
        where: { clerkId },
      });
      logger.info({ clerkId }, 'Clerk User deleted successfully from DB');
    }

    res.json({ success: true });
  } catch (dbErr: any) {
    logger.error({ dbErr }, 'Failed to execute database sync for Clerk webhook');
    res.status(500).json({ error: 'Database syncing failed' });
  }
});

export default router;