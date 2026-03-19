import { Router } from 'express';
import { getMailboxes, createMailbox, updateMailbox, deleteMailbox } from '../controllers/mailbox.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getMailboxes);
router.post('/', requireAuth, createMailbox);
router.put('/:id', requireAuth, updateMailbox);
router.delete('/:id', requireAuth, deleteMailbox);

export default router;