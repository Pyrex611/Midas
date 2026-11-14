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
  gradeCampaignDraft,
  pauseCampaign,
  resumeCampaign,
  getCampaignHealth,
  dispatchCampaignNow,
  reconcileQueueEndpoint,
  repersonalizeCampaignQueue,
  updateScheduledEmail,
  sendScheduledEmailNow,
} from '../controllers/campaign.controller';
import { requireCampaignRole } from '../middleware/campaignAccess.middleware';
import { requireScopeIfApiKey } from '../middleware/dualAuth.middleware';

const router = Router();

// Collaboration & Team Management
router.get('/invites/my', requireScopeIfApiKey('campaigns:read'), getMyInvites);
router.post('/invites/:token/accept', requireScopeIfApiKey('campaigns:write'), acceptInvite);

router.post('/', requireScopeIfApiKey('campaigns:write'), createCampaign);
router.get('/', requireScopeIfApiKey('campaigns:read'), getCampaigns);

// Automation & Configuration endpoints (EDITOR gated)
router.put('/:id/auto-reply', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), updateAutoReply);
router.put('/:id/active-hours', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), updateActiveHours);
router.put('/:id/send-hour', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), updateSendHour);
router.put('/:id/strategy', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), updateCampaignStrategy);

// Campaign Lifecycle Actions
router.post('/:id/pause', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), pauseCampaign);
router.post('/:id/resume', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), resumeCampaign);
router.post('/:id/reconcile-queue', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), reconcileQueueEndpoint);
router.post('/:id/repersonalize-queue', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), repersonalizeCampaignQueue);
router.get('/:id/health', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), getCampaignHealth);
router.post('/:id/dispatch-now', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), dispatchCampaignNow);

// Follow-up Steps
router.get('/:id/followup-steps', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), getFollowUpSteps);
router.post('/:id/followup-steps', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), setFollowUpSteps);
router.delete('/:id/followup-steps/:stepId', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), deleteFollowUpStep);

// Senders (Mailbox Rotation)
router.get('/:id/senders', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), getCampaignSenders);
router.post('/:id/senders', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), addSenderToCampaign);
router.delete('/:id/senders/:senderId', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), removeSenderFromCampaign);

// Pre-Flight Deliverability & Compliance Inspection
router.post('/:id/drafts/grade', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), gradeCampaignDraft);

// Campaign Lifecycle
router.put('/:id', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), updateCampaign);
router.delete('/:id', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('OWNER'), deleteCampaign);
router.get('/:id', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), getCampaignDetails);

// Leads in Campaign
router.post('/:id/leads', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), addLeadsToCampaign);
router.post('/:id/invites', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), createInvite);

// Direct Lead Outreach & Thread Inspection
router.get('/:campaignId/leads/:leadId/thread', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), getLeadEmailThread);
router.get('/:campaignId/leads/:leadId/preview/:draftId', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), previewLeadWithDraft);
router.post('/:campaignId/leads/:leadId/send', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), sendLeadEmail);

// Scheduled Message Inline Editing & Send-Now Override
router.put('/:campaignId/scheduled/:pendingId', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), updateScheduledEmail);
router.post('/:campaignId/scheduled/:pendingId/send-now', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), sendScheduledEmailNow);

// AI Reply Drafting
router.get('/:campaignId/leads/:leadId/reply-draft', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), getReplyDraft);
router.post('/:campaignId/leads/:leadId/generate-reply-draft', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), generateReplyDraft);
router.post('/:campaignId/leads/:leadId/send-reply-draft', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), sendReplyDraft);

// Draft Variations
router.get('/:campaignId/drafts', requireScopeIfApiKey('campaigns:read'), requireCampaignRole('VIEWER'), getCampaignDrafts);
router.put('/:campaignId/drafts/:draftId', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), updateDraft);
router.delete('/:campaignId/drafts/:draftId', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), deleteDraft);
router.post('/:campaignId/drafts/custom', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), createCustomDraft);
router.post('/:campaignId/drafts/generate', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), generateCampaignDraft);
router.post('/:campaignId/steps/:stepNumber/generate-draft', requireScopeIfApiKey('campaigns:write'), requireCampaignRole('EDITOR'), generateStepDraft);

export default router;