import { Router } from 'express';
import { triggerImapPoll } from '../controllers/imap.controller';

const router = Router();

router.post('/poll', triggerImapPoll);

export default router;