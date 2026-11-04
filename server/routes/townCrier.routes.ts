import { Router } from 'express';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listBroadcasts,
  createBroadcast,
  queueBroadcast,
  deleteBroadcast,
  triggerNewsletterSweep,
  listRecipients,
  addRecipient,
  importRecipients,
  deleteRecipient,
} from '../controllers/townCrier.controller';

const router = Router();

// API Key Provisioning (Clerk Authed)
router.get('/api-keys', listApiKeys);
router.post('/api-keys', createApiKey);
router.delete('/api-keys/:id', revokeApiKey);

// Audience & Recipients Management (Clerk Authed)
router.get('/recipients', listRecipients);
router.post('/recipients', addRecipient);
router.post('/recipients/import', ...importRecipients);
router.delete('/recipients/:id', deleteRecipient);

// Broadcast Management (Clerk Authed)
router.get('/broadcasts', listBroadcasts);
router.post('/broadcasts', createBroadcast);
router.post('/broadcasts/:id/queue', queueBroadcast);
router.delete('/broadcasts/:id', deleteBroadcast);
router.post('/sweep', triggerNewsletterSweep);

export default router;