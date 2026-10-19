import { Router } from 'express';
import { optimizeContext } from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/optimize-context', requireAuth, optimizeContext);

export default router;