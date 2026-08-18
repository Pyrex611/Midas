import { Router } from 'express';
import { 
  uploadLeads, 
  getLeads, 
  getLead, 
  updateLead, 
  deleteLead, 
  getUploadJobs, 
  getBlocklist, 
  addBlocklist, 
  deleteBlocklist 
} from '../controllers/lead.controller';

const router = Router();

router.post('/upload', ...uploadLeads);
router.get('/jobs', getUploadJobs);

// Global Blocklist
router.get('/blocklist', getBlocklist);
router.post('/blocklist', addBlocklist);
router.delete('/blocklist/:id', deleteBlocklist);

// Core Lead Management
router.get('/', getLeads);
router.get('/:id', getLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

export default router;