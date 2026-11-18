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
  getAdminAccessStatus,
  toggleUserAdmin,
} from '../controllers/admin.controller';
import { requireAdmin } from '../middleware/requireAdmin.middleware';

const router = Router();

// Lightweight authorization & bootstrap status probe (requires auth only)
router.get('/access-status', getAdminAccessStatus);

// Passphrase Unlock Gateway (only active if OPERATOR_PASSPHRASE is configured)
router.post('/unlock', unlockAdminAccess);

// Protected Operator / Bootstrap Endpoints
router.get('/stats', requireAdmin, getPlatformStats);
router.get('/services-health', requireAdmin, getSystemServicesHealth);
router.post('/locks/:name/clear', requireAdmin, clearCronLock);
router.get('/users', requireAdmin, listUsers);
router.post('/users/:id/admin', requireAdmin, toggleUserAdmin);
router.get('/domains', requireAdmin, listAllDomains);
router.post('/domains/:id/pause', requireAdmin, pauseDomain);
router.post('/domains/:id/unpause', requireAdmin, unpauseDomain);

export default router;