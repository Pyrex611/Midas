import { Router } from 'express';
import { optimizeContext, getAIDiagnostics } from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/optimize-context', requireAuth, optimizeContext);
router.get('/diagnostics', requireAuth, getAIDiagnostics);

export default router;