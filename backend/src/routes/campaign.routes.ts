import { Router } from 'express';
import {
  createCampaign,
  addLeadsToCampaign,
  getCampaigns,
  getCampaign,
  getLeadEmailThread,
  previewLeadWithDraft,
  sendLeadEmail,
  generateReplyDraft,
  updateCampaign,
  deleteCampaign,
  getCampaignDrafts,
  updateDraft,
  deleteDraft,
  createCustomDraft,
  generateCampaignDraft,
  getReplyDraft,
  sendReplyDraft,
} from '../controllers/campaign.controller';

const router = Router();

// Campaign CRUD
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaign);

// Leads in campaign
router.post('/:id/leads', addLeadsToCampaign);
router.get('/:campaignId/leads/:leadId/thread', getLeadEmailThread);
router.get('/:campaignId/leads/:leadId/preview/:draftId', previewLeadWithDraft);
router.post('/:campaignId/leads/:leadId/send', sendLeadEmail);
router.post('/:campaignId/leads/:leadId/generate-reply-draft', generateReplyDraft);
router.get('/:campaignId/leads/:leadId/reply-draft', getReplyDraft);
router.post('/:campaignId/leads/:leadId/send-reply-draft', sendReplyDraft);

// Drafts management
router.get('/:campaignId/drafts', getCampaignDrafts);
router.put('/:campaignId/drafts/:draftId', updateDraft);
router.delete('/:campaignId/drafts/:draftId', deleteDraft);
router.post('/:campaignId/drafts/custom', createCustomDraft);
router.post('/:campaignId/drafts/generate', generateCampaignDraft);
router.post('/:campaignId/leads/:leadId/send-reply-draft', sendReplyDraft);

export default router;