import { Router } from 'express';
import {
  listUsers,
  listAllDomains,
  pauseDomain,
  unpauseDomain,
  getPlatformStats,
  unlockAdminAccess,
  getSystemServicesHealth,
  clearCronLock,
} from '../controllers/admin.controller';
import { requireAdmin } from '../middleware/requireAdmin.middleware';

const router = Router();

// Unlock Gateway (Accessible with valid master passphrase)
router.post('/unlock', unlockAdminAccess);

// Protected Operator Endpoints
router.get('/stats', requireAdmin, getPlatformStats);
router.get('/services-health', requireAdmin, getSystemServicesHealth);
router.post('/locks/:name/clear', requireAdmin, clearCronLock);
router.get('/users', requireAdmin, listUsers);
router.get('/domains', requireAdmin, listAllDomains);
router.post('/domains/:id/pause', requireAdmin, pauseDomain);
router.post('/domains/:id/unpause', requireAdmin, unpauseDomain);

export default router;