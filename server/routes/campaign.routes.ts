import { Router } from 'express';
import {
  createCampaign,
  addLeadsToCampaign,
  getCampaigns,
  getCampaignDetails,
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
  updateAutoReply,
  getFollowUpSteps,
  setFollowUpSteps,
  deleteFollowUpStep,
  updateSendHour,
  generateStepDraft,
  updateActiveHours,
  getCampaignDomains,
  addDomainToCampaign,
  removeDomainFromCampaign,
  getMyInvites,
  acceptInvite,
  createInvite,
  updateCampaignStrategy,
} from '../controllers/campaign.controller';

const router = Router();

// Core Collaboration endpoints
router.get('/invites/my', getMyInvites);
router.post('/invites/:token/accept', acceptInvite);

router.post('/', createCampaign);
router.get('/', getCampaigns);

router.put('/:id/auto-reply', updateAutoReply);
router.put('/:id/active-hours', updateActiveHours);
router.put('/:id/send-hour', updateSendHour);
router.put('/:id/strategy', updateCampaignStrategy);

router.get('/:id/followup-steps', getFollowUpSteps);
router.post('/:id/followup-steps', setFollowUpSteps);
router.delete('/:id/followup-steps/:stepId', deleteFollowUpStep);

router.get('/:id/domains', getCampaignDomains);
router.post('/:id/domains', addDomainToCampaign);
router.delete('/:id/domains/:domainId', removeDomainFromCampaign);

router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.get('/:id', getCampaignDetails);

router.post('/:id/leads', addLeadsToCampaign);
router.post('/:id/invites', createInvite);

router.get('/:campaignId/leads/:leadId/thread', getLeadEmailThread);
router.get('/:campaignId/leads/:leadId/preview/:draftId', previewLeadWithDraft);
router.post('/:campaignId/leads/:leadId/send', sendLeadEmail);

router.get('/:campaignId/leads/:leadId/reply-draft', getReplyDraft);
router.post('/:campaignId/leads/:leadId/generate-reply-draft', generateReplyDraft);
router.post('/:campaignId/leads/:leadId/send-reply-draft', sendReplyDraft);

router.get('/:campaignId/drafts', getCampaignDrafts);
router.put('/:campaignId/drafts/:draftId', updateDraft);
router.delete('/:campaignId/drafts/:draftId', deleteDraft);
router.post('/:campaignId/drafts/custom', createCustomDraft);
router.post('/:campaignId/drafts/generate', generateCampaignDraft);
router.post('/:campaignId/steps/:stepNumber/generate-draft', generateStepDraft);

export default router;