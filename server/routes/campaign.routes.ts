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
  getCampaignSenders,
  addSenderToCampaign,
  removeSenderFromCampaign,
  getMyInvites,
  acceptInvite,
  createInvite,
  updateCampaignStrategy,
} from '../controllers/campaign.controller';
import { requireCampaignRole } from '../middleware/campaignAccess.middleware';

const router = Router();

// Collaboration & Team Management (no campaignId in scope for these two)
router.get('/invites/my', getMyInvites);
router.post('/invites/:token/accept', acceptInvite);

router.post('/', createCampaign);
router.get('/', getCampaigns);

// --- Everything below targets a specific campaign and MUST be role-gated. ---
// VIEWER = read-only. EDITOR = manage leads/drafts/automation. OWNER = destructive/ownership actions.

router.put('/:id/auto-reply', requireCampaignRole('EDITOR'), updateAutoReply);
router.put('/:id/active-hours', requireCampaignRole('EDITOR'), updateActiveHours);
router.put('/:id/send-hour', requireCampaignRole('EDITOR'), updateSendHour);
router.put('/:id/strategy', requireCampaignRole('EDITOR'), updateCampaignStrategy);

router.get('/:id/followup-steps', requireCampaignRole('VIEWER'), getFollowUpSteps);
router.post('/:id/followup-steps', requireCampaignRole('EDITOR'), setFollowUpSteps);
router.delete('/:id/followup-steps/:stepId', requireCampaignRole('EDITOR'), deleteFollowUpStep);

router.get('/:id/senders', requireCampaignRole('VIEWER'), getCampaignSenders);
router.post('/:id/senders', requireCampaignRole('EDITOR'), addSenderToCampaign);
router.delete('/:id/senders/:senderId', requireCampaignRole('EDITOR'), removeSenderFromCampaign);

router.put('/:id', requireCampaignRole('EDITOR'), updateCampaign);
router.delete('/:id', requireCampaignRole('OWNER'), deleteCampaign);
router.get('/:id', requireCampaignRole('VIEWER'), getCampaignDetails);

router.post('/:id/leads', requireCampaignRole('EDITOR'), addLeadsToCampaign);
router.post('/:id/invites', requireCampaignRole('EDITOR'), createInvite);

router.get('/:campaignId/leads/:leadId/thread', requireCampaignRole('VIEWER'), getLeadEmailThread);
router.get('/:campaignId/leads/:leadId/preview/:draftId', requireCampaignRole('VIEWER'), previewLeadWithDraft);
router.post('/:campaignId/leads/:leadId/send', requireCampaignRole('EDITOR'), sendLeadEmail);

router.get('/:campaignId/leads/:leadId/reply-draft', requireCampaignRole('VIEWER'), getReplyDraft);
router.post('/:campaignId/leads/:leadId/generate-reply-draft', requireCampaignRole('EDITOR'), generateReplyDraft);
router.post('/:campaignId/leads/:leadId/send-reply-draft', requireCampaignRole('EDITOR'), sendReplyDraft);

router.get('/:campaignId/drafts', requireCampaignRole('VIEWER'), getCampaignDrafts);
router.put('/:campaignId/drafts/:draftId', requireCampaignRole('EDITOR'), updateDraft);
router.delete('/:campaignId/drafts/:draftId', requireCampaignRole('EDITOR'), deleteDraft);
router.post('/:campaignId/drafts/custom', requireCampaignRole('EDITOR'), createCustomDraft);
router.post('/:campaignId/drafts/generate', requireCampaignRole('EDITOR'), generateCampaignDraft);
router.post('/:campaignId/steps/:stepNumber/generate-draft', requireCampaignRole('EDITOR'), generateStepDraft);

export default router;
