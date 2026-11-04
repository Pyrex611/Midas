import { Router } from 'express';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listBroadcasts,
  createBroadcast,
  queueBroadcast,
  triggerNewsletterSweep,
} from '../controllers/townCrier.controller';

const router = Router();

// API Key Provisioning (Clerk Authed)
router.get('/api-keys', listApiKeys);
router.post('/api-keys', createApiKey);
router.delete('/api-keys/:id', revokeApiKey);

// Broadcast Management
router.get('/broadcasts', listBroadcasts);
router.post('/broadcasts', createBroadcast);
router.post('/broadcasts/:id/queue', queueBroadcast);
router.post('/sweep', triggerNewsletterSweep);

export default router;