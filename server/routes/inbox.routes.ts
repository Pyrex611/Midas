import { Router } from 'express';
import { getUnifiedInbox, sendManualReply, startConversation } from '../controllers/inbox.controller';

const router = Router();

router.get('/', getUnifiedInbox);
router.post('/start', startConversation);
router.post('/:leadId/reply', sendManualReply);

export default router;