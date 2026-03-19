import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireCampaignAccess } from '../middleware/campaign.middleware';
import * as campaignCtrl from '../controllers/campaign.controller';
import * as inviteCtrl from '../controllers/invite.controller';

const router = Router();

// ==========================================
// 1. GLOBAL ROUTES (No Campaign ID yet)
// ==========================================
router.get('/', requireAuth, campaignCtrl.getCampaigns);
router.post('/', requireAuth, campaignCtrl.createCampaign);
router.get('/invites/me', requireAuth, inviteCtrl.getMyInvites);
router.post('/accept-invite', requireAuth, inviteCtrl.acceptInvite);

// ==========================================
// 2. READ-ONLY ROUTES (VIEWER Role)
// ==========================================
// Basic details
router.get('/:id', requireAuth, requireCampaignAccess('VIEWER'), campaignCtrl.getCampaign);
router.get('/:id/mailboxes', requireAuth, requireCampaignAccess('VIEWER'), campaignCtrl.getCampaignMailboxes);
router.get('/:id/followup-steps', requireAuth, requireCampaignAccess('VIEWER'), campaignCtrl.getFollowUpSteps);

// Drafts & Leads
router.get('/:campaignId/drafts', requireAuth, requireCampaignAccess('VIEWER'), campaignCtrl.getCampaignDrafts);
router.get('/:campaignId/leads/:leadId/thread', requireAuth, requireCampaignAccess('VIEWER'), campaignCtrl.getLeadEmailThread);
router.get('/:campaignId/leads/:leadId/preview/:draftId', requireAuth, requireCampaignAccess('VIEWER'), campaignCtrl.previewLeadWithDraft);
router.get('/:campaignId/leads/:leadId/reply-draft', requireAuth, requireCampaignAccess('VIEWER'), campaignCtrl.getReplyDraft);

// ==========================================
// 3. OPERATIONAL ROUTES (EDITOR Role)
// ==========================================
// Lead Management
router.post('/:id/leads', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.addLeadsToCampaign);
router.post('/:campaignId/leads/:leadId/send', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.sendLeadEmail);
router.post('/:campaignId/leads/:leadId/generate-reply-draft', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.generateReplyDraft);
router.post('/:campaignId/leads/:leadId/send-reply-draft', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.sendReplyDraft);
router.put('/:id/strategy', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.updateStrategy);

// Settings Updates
router.put('/:id/auto-reply', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.updateAutoReply);
router.put('/:id/active-hours', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.updateActiveHours);
router.put('/:id/send-hour', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.updateSendHour);

// Step & Draft Management
router.post('/:id/followup-steps', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.setFollowUpSteps);
router.post('/:id/mailboxes', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.addMailboxToCampaign);
router.post('/:campaignId/drafts/custom', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.createCustomDraft);
router.post('/:campaignId/drafts/generate', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.generateCampaignDraft);
router.post('/:campaignId/steps/:stepNumber/generate-draft', requireAuth, requireCampaignAccess('EDITOR'), campaignCtrl.generateStepDraft);

// ==========================================
// 4. ADMINISTRATIVE ROUTES (OWNER Role)
// ==========================================
router.put('/:id', requireAuth, requireCampaignAccess('OWNER'), campaignCtrl.updateCampaign);
router.delete('/:id', requireAuth, requireCampaignAccess('OWNER'), campaignCtrl.deleteCampaign);
router.post('/:id/invites', requireAuth, requireCampaignAccess('OWNER'), inviteCtrl.createInvite);
router.delete('/:id/followup-steps/:stepId', requireAuth, requireCampaignAccess('OWNER'), campaignCtrl.deleteFollowUpStep);
router.delete('/:id/mailboxes/:mailboxId', requireAuth, requireCampaignAccess('OWNER'), campaignCtrl.removeMailboxFromCampaign);

export default router;