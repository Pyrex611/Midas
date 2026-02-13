import { Router } from 'express';
import {
  uploadLeads,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
  confirmEmailSelection,
  getDbStats,
} from '../controllers/lead.controller';

const router = Router();

/**
 * POST /api/leads/upload
 * Upload CSV/XLSX/TXT file with leads
 */
router.post('/upload', ...uploadLeads);

/**
 * POST /api/leads/confirm-email-selection
 * Lets user select what lead email to use if more than one available
 */
router.post('/confirm-email-selection', confirmEmailSelection);

/**
 * GET /api/leads
 * List leads with pagination and optional status filter
 */
router.get('/', getLeads);

/**
 * GET /api/leads/:id
 * Retrieve a single lead by ID
 */
router.get('/:id', getLead);

/**
 * PUT /api/leads/:id
 * Update a lead
 */
router.put('/:id', updateLead);

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete('/:id', deleteLead);

router.get('/debug/stats', getDbStats);

export default router;