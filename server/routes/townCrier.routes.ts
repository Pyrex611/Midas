import { Router } from 'express';
import {
  getTownCrierAnalytics,
  exportRecipients,
  listRecipients,
  addRecipient,
  importRecipients,
  deleteRecipient,
  listBroadcasts,
  createBroadcast,
  queueBroadcast,
  deleteBroadcast,
  triggerNewsletterSweep,
  listGongs,
  createGong,
  updateGong,
  deleteGong,
} from '../controllers/townCrier.controller';

const router = Router();

// Audience Analytics & Contacts Dump
router.get('/analytics', getTownCrierAnalytics);
router.get('/recipients/export', exportRecipients);

// Gong Channel CRUD (authenticated dashboard)
router.get('/gongs', listGongs);
router.post('/gongs', createGong);
router.put('/gongs/:id', updateGong);
router.delete('/gongs/:id', deleteGong);

// Recipients (Subscribers)
router.get('/recipients', listRecipients);
router.post('/recipients', addRecipient);
router.post('/recipients/import', ...importRecipients);
router.delete('/recipients/:id', deleteRecipient);

// Broadcasts
router.get('/broadcasts', listBroadcasts);
router.post('/broadcasts', createBroadcast);
router.post('/broadcasts/:id/queue', queueBroadcast);
router.delete('/broadcasts/:id', deleteBroadcast);

// Manual Bounded Sweep (<= 5 sends)
router.post('/sweep', triggerNewsletterSweep);

export default router;