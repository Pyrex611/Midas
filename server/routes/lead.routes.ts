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

const router = Router();

router.post('/upload', ...uploadLeads);
router.get('/jobs', getUploadJobs);

router.get('/blocklist', getBlocklist);
router.post('/blocklist', addBlocklist);
router.delete('/blocklist/:id', deleteBlocklist);

router.get('/', getLeads);
router.get('/:id', getLead);
router.post('/:id/enrich', enrichLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

export default router;