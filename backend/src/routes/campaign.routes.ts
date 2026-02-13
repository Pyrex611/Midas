import { Router } from 'express';
import {
  createCampaign,
  addLeadsToCampaign,
  getCampaigns,
  getCampaign,
  getLeadEmailPreview,
  sendLeadEmail,
} from '../controllers/campaign.controller';

const router = Router();

router.post('/', createCampaign);
router.post('/:id/leads', addLeadsToCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaign);
router.get('/:campaignId/leads/:leadId/preview', getLeadEmailPreview);
router.post('/:campaignId/leads/:leadId/send', sendLeadEmail);

export default router;