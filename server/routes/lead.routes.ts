import { Router } from 'express';
import {
  uploadLeads,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
  enrichLead,
  getUploadJobs,
  getBlocklist,
  addBlocklist,
  deleteBlocklist,
} from '../controllers/lead.controller';
import { requireScopeIfApiKey } from '../middleware/dualAuth.middleware';

const router = Router();

router.post('/upload', requireScopeIfApiKey('leads:write'), ...uploadLeads);
router.get('/jobs', requireScopeIfApiKey('leads:read'), getUploadJobs);

router.get('/blocklist', requireScopeIfApiKey('leads:read'), getBlocklist);
router.post('/blocklist', requireScopeIfApiKey('leads:write'), addBlocklist);
router.delete('/blocklist/:id', requireScopeIfApiKey('leads:write'), deleteBlocklist);

router.get('/', requireScopeIfApiKey('leads:read'), getLeads);
router.get('/:id', requireScopeIfApiKey('leads:read'), getLead);
router.post('/:id/enrich', requireScopeIfApiKey('leads:write'), enrichLead);
router.put('/:id', requireScopeIfApiKey('leads:write'), updateLead);
router.delete('/:id', requireScopeIfApiKey('leads:write'), deleteLead);

export default router;