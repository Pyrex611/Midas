import { Router } from 'express';
import {
  optimizeContext,
  getAIDiagnostics,
  testAIConfiguration,
  getConfirmedIntegrations,
  confirmProvider,
  addModelToProvider,
  switchActiveProviderAndModel,
  deleteIntegration,
  deleteModel,
} from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/optimize-context', requireAuth, optimizeContext);
router.get('/diagnostics', requireAuth, getAIDiagnostics);
router.post('/test', requireAuth, testAIConfiguration);

// Dynamic Multi-Provider & Model Hub Endpoints
router.get('/integrations', requireAuth, getConfirmedIntegrations);
router.post('/confirm', requireAuth, confirmProvider);
router.post('/add-model', requireAuth, addModelToProvider);
router.post('/switch-active', requireAuth, switchActiveProviderAndModel);
router.delete('/integrations/:id', requireAuth, deleteIntegration);
router.delete('/integrations/:id/models', requireAuth, deleteModel);

export default router;