import { Router } from 'express';
import {
  createCampaign,
  addLeadsToCampaign,
  getCampaigns,
  getCampaign,
  getLeadEmailPreview,
  sendLeadEmail,
  updateCampaign,
  deleteCampaign,
  getCampaignDrafts,           // ✅ NEW
  previewLeadWithDraft,         // ✅ NEW
  generateCampaignDraft,        // already exists
} from '../controllers/campaign.controller';

const router = Router();

router.post('/', createCampaign);
router.post('/:id/leads', addLeadsToCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaign);
router.get('/:campaignId/leads/:leadId/preview', getLeadEmailPreview);
router.post('/:campaignId/leads/:leadId/send', sendLeadEmail);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.get('/:campaignId/drafts', getCampaignDrafts);                     // ✅
router.get('/:campaignId/leads/:leadId/preview/:draftId', previewLeadWithDraft); // ✅
router.post('/:campaignId/drafts/generate', generateCampaignDraft);

export default router;