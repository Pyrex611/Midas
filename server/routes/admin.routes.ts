import { Router } from 'express';
import {
  listUsers,
  listAllDomains,
  pauseDomain,
  unpauseDomain,
  getPlatformStats,
  unlockAdminAccess,
} from '../controllers/admin.controller';
import { requireAdmin } from '../middleware/requireAdmin.middleware';

const router = Router();

// 1. UNLOCK GATEWAY (Accessible to any authenticated user who submits the master passphrase)
router.post('/unlock', unlockAdminAccess);

// 2. PROTECTED OPERATOR ENDPOINTS (Guarded by requireAdmin: requires DB isAdmin OR active x-operator-token)
router.get('/stats', requireAdmin, getPlatformStats);
router.get('/users', requireAdmin, listUsers);
router.get('/domains', requireAdmin, listAllDomains);
router.post('/domains/:id/pause', requireAdmin, pauseDomain);
router.post('/domains/:id/unpause', requireAdmin, unpauseDomain);

export default router;