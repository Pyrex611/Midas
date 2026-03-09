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
  getReplyDraft,
  sendReplyDraft,
  updateCampaign,
  deleteCampaign,
  getCampaignDrafts,
  updateDraft,
  deleteDraft,
  createCustomDraft,
  generateCampaignDraft,
  updateFollowUpSettings,
  updateAutoReply,
  getFollowUpSteps,
  setFollowUpSteps,
  deleteFollowUpStep,
  updateSendHour,
	generateStepDraft,
} from '../controllers/campaign.controller';

const router = Router();

// Create campaign
router.post('/', createCampaign);

// Specific campaign actions (must come before generic :id routes)
router.put('/:id/followup', updateFollowUpSettings);
router.put('/:id/auto-reply', updateAutoReply);
router.get('/:id/followup-steps', getFollowUpSteps);
router.post('/:id/followup-steps', setFollowUpSteps);
router.delete('/:id/followup-steps/:stepId', deleteFollowUpStep);
router.put('/:id/send-hour', updateSendHour);

// Generic campaign CRUD
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.get('/:id', getCampaign);

// Leads management
router.post('/:id/leads', addLeadsToCampaign);
router.get('/:campaignId/leads/:leadId/thread', getLeadEmailThread);
router.get('/:campaignId/leads/:leadId/preview/:draftId', previewLeadWithDraft);
router.post('/:campaignId/leads/:leadId/send', sendLeadEmail);
router.get('/:campaignId/leads/:leadId/reply-draft', getReplyDraft);
router.post('/:campaignId/leads/:leadId/generate-reply-draft', generateReplyDraft);
router.post('/:campaignId/leads/:leadId/send-reply-draft', sendReplyDraft);

// Drafts management
router.get('/:campaignId/drafts', getCampaignDrafts);
router.put('/:campaignId/drafts/:draftId', updateDraft);
router.delete('/:campaignId/drafts/:draftId', deleteDraft);
router.post('/:campaignId/drafts/custom', createCustomDraft);
router.post('/:campaignId/drafts/generate', generateCampaignDraft);
router.post('/:campaignId/steps/:stepNumber/generate-draft', generateStepDraft);

// Get all campaigns (should be after specific routes)
router.get('/', getCampaigns);

export default router;