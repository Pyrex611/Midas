import { Router } from 'express';
import {
  uploadLeads,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
} from '../controllers/lead.controller';

const router = Router();

router.post('/upload', ...uploadLeads);
router.get('/', getLeads);
router.get('/:id', getLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

export default router;