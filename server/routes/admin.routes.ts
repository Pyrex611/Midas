import { Router } from 'express';
import { listUsers, listAllDomains, pauseDomain, unpauseDomain, getPlatformStats } from '../controllers/admin.controller';

const router = Router();

router.get('/stats', getPlatformStats);
router.get('/users', listUsers);
router.get('/domains', listAllDomains);
router.post('/domains/:id/pause', pauseDomain);
router.post('/domains/:id/unpause', unpauseDomain);

export default router;
