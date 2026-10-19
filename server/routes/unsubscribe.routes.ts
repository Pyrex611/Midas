import { Router } from 'express';
import { unsubscribeOneClick, unsubscribePage } from '../controllers/unsubscribe.controller';

const router = Router();

// GET: a human clicking the link in the email body — shows a confirmation page.
router.get('/:token', unsubscribePage);
// POST: RFC 8058 one-click unsubscribe, sent by the recipient's mail client
// itself (Gmail/Yahoo/etc.), no confirmation page needed or expected.
router.post('/:token', unsubscribeOneClick);

export default router;
