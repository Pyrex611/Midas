import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/userSettings.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getSettings);
router.put('/', requireAuth, updateSettings);

export default router;