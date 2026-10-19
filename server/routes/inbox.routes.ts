import { Router } from 'express';
import { getUnifiedInbox, sendManualReply } from '../controllers/inbox.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getUnifiedInbox);
router.post('/:leadId/reply', requireAuth, sendManualReply);

export default router;