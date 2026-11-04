import { Router } from 'express';
import { emailQueueService } from '../services/emailQueue.service';
import { followUpService } from '../services/followUp.service';
import { leadQueueService } from '../services/leadQueue.service';
import { newsletterQueueService } from '../services/newsletterQueue.service';
import { withCronLock } from '../lib/cronLock';
import { verifyCronRequest } from '../middleware/cronAuth.middleware';

const router = Router();

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
  newsletter: async (_req: any, res: any) => {
    const result = await withCronLock('newsletter', () => newsletterQueueService.processNewsletterQueue());
    res.json({ success: true, ...result });
  },
};

router.get('/queue', verifyCronRequest, handlers.queue);
router.post('/queue', verifyCronRequest, handlers.queue);

router.get('/followups', verifyCronRequest, handlers.followups);
router.post('/followups', verifyCronRequest, handlers.followups);

router.get('/leads', verifyCronRequest, handlers.leads);
router.post('/leads', verifyCronRequest, handlers.leads);

router.get('/newsletter', verifyCronRequest, handlers.newsletter);
router.post('/newsletter', verifyCronRequest, handlers.newsletter);

export default router;