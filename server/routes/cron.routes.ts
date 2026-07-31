import { Router } from 'express';
import { emailQueueService } from '../services/emailQueue.service';
import { followUpService } from '../services/followUp.service';
import { leadQueueService } from '../services/leadQueue.service';

const router = Router();

const verifyCron = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized Cron Execution' });
  }
  next();
};

router.post('/queue', verifyCron, async (req, res) => {
  await emailQueueService.processQueue();
  res.json({ success: true });
});

router.post('/followups', verifyCron, async (req, res) => {
  await followUpService.checkFollowUps();
  res.json({ success: true });
});

router.post('/leads', verifyCron, async (req, res) => {
  await leadQueueService.processPendingUploads();
  res.json({ success: true });
});

export default router;