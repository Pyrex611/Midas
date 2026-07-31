import { Router } from 'express';
import { uploadLeads, getLeads, deleteLead, getUploadJobs, getBlocklist, addBlocklist, deleteBlocklist } from '../controllers/lead.controller';

const router = Router();

router.post('/upload', ...uploadLeads);
router.get('/jobs', getUploadJobs);

// Global Blocklist routes
router.get('/blocklist', getBlocklist);
router.post('/blocklist', addBlocklist);
router.delete('/blocklist/:id', deleteBlocklist);

router.get('/', getLeads);
router.delete('/:id', deleteLead);

export default router;