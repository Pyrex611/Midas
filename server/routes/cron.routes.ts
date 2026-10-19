import { Router } from 'express';
import { emailQueueService } from '../services/emailQueue.service';
import { followUpService } from '../services/followUp.service';
import { leadQueueService } from '../services/leadQueue.service';
import { logger } from '../config/logger';
import { withCronLock } from '../lib/cronLock';
import { verifyCronRequest } from '../middleware/cronAuth.middleware';

const router = Router();

// Each handler is wrapped in a DB-backed lock (server/lib/cronLock.ts) so
// that no matter how many schedulers are pointed at these endpoints —
// Vercel Cron, the GitHub Actions backup poller, Upstash QStash schedules —
// only one instance actually runs a given job's body at a time. This is on
// top of (not instead of) the row-level `SELECT ... FOR UPDATE SKIP LOCKED`
// claiming already used inside emailQueue/leadQueue — the lock here prevents
// wasted duplicate work and, for the follow-up sequencer specifically
// (which does not use row-level claiming), prevents the same follow-up step
// from being queued twice by two overlapping invocations.
const handlers = {
  queue: async (_req: any, res: any) => {
    const result = await withCronLock('queue', () => emailQueueService.processQueue());
    res.json({ success: true, ...result });
  },
  followups: async (_req: any, res: any) => {
    const result = await withCronLock('followups', () => followUpService.checkFollowUps());
    res.json({ success: true, ...result });
  },
  leads: async (_req: any, res: any) => {
    const result = await withCronLock('leads', () => leadQueueService.processPendingUploads());
    res.json({ success: true, ...result });
  },
};

// Accept both GET (Vercel Cron / most external cron UIs default to GET)
// and POST (curl, GitHub Actions, QStash) on every job. Auth accepts either
// a static Bearer CRON_SECRET (Vercel/GitHub Actions/cron-job.org) or a
// verified Upstash QStash signature — see cronAuth.middleware.ts.
router.get('/queue', verifyCronRequest, handlers.queue);
router.post('/queue', verifyCronRequest, handlers.queue);

router.get('/followups', verifyCronRequest, handlers.followups);
router.post('/followups', verifyCronRequest, handlers.followups);

router.get('/leads', verifyCronRequest, handlers.leads);
router.post('/leads', verifyCronRequest, handlers.leads);

export default router;
