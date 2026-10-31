import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { campaignAPI, senderAPI, getErrorMessage } from '../services/api';
import { Sheet } from '../components/common/Sheet';
import { SequenceCanvas } from '../components/campaigns/SequenceCanvas';
import { SpintaxSimulator } from '../components/campaigns/SpintaxSimulator';
import { DeliverabilityGrader } from '../components/campaigns/DeliverabilityGrader';
import { LeadDrawer } from '../components/leads/LeadDrawer';
import { UploadArea } from '../components/UploadArea';
import { RenameCampaignModal } from '../components/RenameCampaignModal';
import { DeleteCampaignModal } from '../components/DeleteCampaignModal';
import { EditStrategyModal } from '../components/EditStrategyModal';
import { InviteCollaboratorModal } from '../components/InviteCollaboratorModal';
import { useToast } from '../context/ToastContext';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney',
];

interface HealthAlert {
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'RESUME' | 'ACTIVATE' | 'ASSIGN_SENDERS' | 'NAVIGATE_DOMAINS' | 'DISPATCH_NOW' | 'ADJUST_HOURS' | 'RECONCILE_QUEUE' | 'REPERSONALIZE';
}

type DrilldownCategory = 'ALL' | 'CONTACTED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'BOUNCED' | 'UNSUBSCRIBED';

export const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'flow' | 'leads' | 'drafts' | 'automation' | 'settings'>('dashboard');

  const [drilldownCategory, setDrilldownCategory] = useState<DrilldownCategory | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');

  const [healthAlerts, setHealthAlerts] = useState<HealthAlert[]>([]);
  const [isDispatchingNow, setIsDispatchingNow] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRepersonalizing, setIsRepersonalizing] = useState(false);

  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [previewLead, setPreviewLead] = useState<any | null>(null);
  const [isLeadDrawerOpen, setIsLeadDrawerOpen] = useState(false);

  const [isDraftDrawerOpen, setIsDraftDrawerOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const [userSenders, setUserSenders] = useState<any[]>([]);
  const [campaignSenderIds, setCampaignSenderIds] = useState<Set<string>>(new Set());
  const [updatingSender, setUpdatingSender] = useState(false);

  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [savingAutoReply, setSavingAutoReply] = useState(false);
  const [sendHourUTC, setSendHourUTC] = useState(9);
  const [savingSendHour, setSavingSendHour] = useState(false);
  const [activeStartHour, setActiveStartHour] = useState<number | ''>('');
  const [activeEndHour, setActiveEndHour] = useState<number | ''>('');
  const [timezone, setTimezone] = useState('UTC');
  const [savingActiveHours, setSavingActiveHours] = useState(false);
  const [followUpSteps, setFollowUpSteps] = useState<any[]>([]);
  const [savingSteps, setSavingSteps] = useState(false);
  const [generatingDraftFor, setGeneratingDraftFor] = useState<number | null>(null);

  const role: 'OWNER' | 'EDITOR' | 'VIEWER' = campaign?.role || 'VIEWER';
  const canEdit = role === 'OWNER' || role === 'EDITOR';
  const canDelete = role === 'OWNER';

  const fetchCampaign = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, healthRes] = await Promise.all([
        campaignAPI.get(id),
        campaignAPI.getHealth(id).catch(() => ({ data: { alerts: [] } })),
      ]);
      setCampaign(res.data);
      setAutoReplyEnabled(res.data.autoReplyEnabled || false);
      setSendHourUTC(res.data.sendHourUTC ?? 9);
      setActiveStartHour(res.data.activeStartHour ?? '');
      setActiveEndHour(res.data.activeEndHour ?? '');
      setTimezone(res.data.timezone || 'UTC');
      setFollowUpSteps((res.data.followUpSteps || []).sort((a: any, b: any) => a.stepNumber - b.stepNumber));
      setHealthAlerts(healthRes.data?.alerts || []);
    } catch {
      toast.error('Failed to load campaign data', 'Network Error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSenders = async () => {
    try {
      const [allRes, assignedRes] = await Promise.all([
        senderAPI.listAll(),
        campaignAPI.getCampaignSenders(id!),
      ]);
      setUserSenders(allRes.data || []);
      setCampaignSenderIds(new Set((assignedRes.data || []).map((s: any) => s.id)));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCampaign();
    fetchSenders();
  }, [id]);

  const handleUpdate = () => {
    fetchCampaign();
    fetchSenders();
    setMenuOpen(false);
  };

  const handleReconcileQueue = async () => {
    if (!id) return;
    setIsReconciling(true);
    try {
      const res = await campaignAPI.reconcileQueue(id);
      toast.success(res.data?.message || 'Queue reconciled', 'Queue Staged');
      await fetchCampaign();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not reconcile queue'), 'Queue Error');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRepersonalizeQueue = async () => {
    if (!id) return;
    setIsRepersonalizing(true);
    try {
      const res = await campaignAPI.repersonalizeQueue(id);
      toast.success(res.data?.message || 'Queued emails re-personalized', 'Re-Personalized');
      await fetchCampaign();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not re-personalize queued emails'), 'Error');
    } finally {
      setIsRepersonalizing(false);
    }
  };

  const handleTogglePauseResume = async () => {
    if (!id || !campaign) return;
    setMenuOpen(false);
    try {
      if (campaign.status === 'PAUSED') {
        await campaignAPI.resume(id);
        toast.success('Campaign outreach resumed and queue reconciled', 'Active');
      } else {
        await campaignAPI.pause(id);
        toast.warning('Campaign outreach paused', 'Halted');
      }
      await fetchCampaign();
    } catch {
      toast.error('Could not update campaign status', 'Error');
    }
  };

  const handleDispatchNow = async () => {
    if (!id) return;
    setIsDispatchingNow(true);
    try {
      const res = await campaignAPI.dispatchNow(id);
      const sent = res.data?.summary?.sent || 0;
      toast.success(`Dispatched send sweep: ${sent} email(s) sent`, 'Queue Processed');
      await fetchCampaign();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not trigger queue sweep'), 'Dispatch Error');
    } finally {
      setIsDispatchingNow(false);
    }
  };

  const handleAlertAction = (actionType?: string) => {
    switch (actionType) {
      case 'RESUME':
      case 'ACTIVATE':
        handleTogglePauseResume();
        break;
      case 'RECONCILE_QUEUE':
        handleReconcileQueue();
        break;
      case 'REPERSONALIZE':
        handleRepersonalizeQueue();
        break;
      case 'ASSIGN_SENDERS':
        setActiveTab('settings');
        break;
      case 'NAVIGATE_DOMAINS':
        navigate('/domains');
        break;
      case 'DISPATCH_NOW':
        handleDispatchNow();
        break;
      case 'ADJUST_HOURS':
        setActiveTab('automation');
        break;
      default:
        break;
    }
  };

  const handleDeleteCampaign = async () => {
    if (!id) return;
    try {
      await campaignAPI.delete(id);
      toast.info('Campaign purged permanently', 'Deleted');
      navigate('/campaigns');
    } catch {
      toast.error('Could not delete campaign', 'Error');
    }
  };

  const toggleSender = async (senderId: string, checked: boolean) => {
    setUpdatingSender(true);
    try {
      if (checked) {
        await campaignAPI.addSenderToCampaign(id!, senderId);
        setCampaignSenderIds(prev => new Set(prev).add(senderId));
        toast.success('Mailbox attached to campaign rotation', 'Sender Active');
      } else {
        await campaignAPI.removeSenderFromCampaign(id!, senderId);
        setCampaignSenderIds(prev => {
          const next = new Set(prev);
          next.delete(senderId);
          return next;
        });
        toast.info('Mailbox unlinked from rotation', 'Sender Removed');
      }
      await fetchCampaign();
    } catch {
      toast.error('Could not update sender link', 'Error');
    } finally {
      setUpdatingSender(false);
    }
  };

  const handleOpenDraftDrawer = (draft?: any) => {
    if (draft) {
      setEditingDraft(draft);
      setDraftSubject(draft.subject || '');
      setDraftBody(draft.body || '');
    } else {
      setEditingDraft(null);
      setDraftSubject('');
      setDraftBody('');
    }
    setIsDraftDrawerOpen(true);
  };

  const handleSaveDraft = async () => {
    if (!draftSubject.trim() || !draftBody.trim()) return;
    setSavingDraft(true);
    try {
      if (editingDraft) {
        await campaignAPI.updateDraft(id!, editingDraft.id, { subject: draftSubject, body: draftBody });
        toast.success('Draft variation updated', 'Saved');
      } else {
        await campaignAPI.createCustomDraft(id!, { subject: draftSubject, body: draftBody });
        toast.success('New draft variation created', 'Saved');
      }
      setIsDraftDrawerOpen(false);
      await fetchCampaign();
    } catch {
      toast.error('Could not save draft', 'Error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft variation?')) return;
    try {
      await campaignAPI.deleteDraft(id!, draftId);
      toast.info('Draft variation deleted', 'Deleted');
      await fetchCampaign();
    } catch {
      toast.error('Could not delete draft', 'Error');
    }
  };

  // Live AI Draft Generation with 5-Second Real Error Pop-Up
  const handleGenerateAiDraft = async () => {
    setGeneratingDraft(true);
    try {
      await campaignAPI.generateDraft(id!);
      toast.success('AI synthesized a fresh tonal draft variation', 'Synthesized');
      await fetchCampaign();
    } catch (err: any) {
      const errorMsg = getErrorMessage(err, 'Failed to synthesize draft with active AI provider');
      toast.error(errorMsg, 'AI Generation Error');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleGenerateStepDraft = async (stepNumber: number) => {
    setGeneratingDraftFor(stepNumber);
    try {
      await campaignAPI.generateStepDraft(id!, stepNumber);
      toast.success(`Synthesized AI draft for step #${stepNumber}`, 'Complete');
      await fetchCampaign();
    } catch (err: any) {
      const errorMsg = getErrorMessage(err, `Failed to generate draft for step #${stepNumber}`);
      toast.error(errorMsg, 'AI Step Draft Error');
    } finally {
      setGeneratingDraftFor(null);
    }
  };

  const handleToggleAutoReply = async (checked: boolean) => {
    setAutoReplyEnabled(checked);
    setSavingAutoReply(true);
    try {
      await campaignAPI.updateAutoReply(id!, { autoReplyEnabled: checked });
      toast.success(`Autonomous AI auto-reply is now ${checked ? 'ACTIVE' : 'PAUSED'}`, 'Auto-Reply');
    } catch {
      setAutoReplyEnabled(!checked);
      toast.error('Could not update auto-reply setting', 'Error');
    } finally {
      setSavingAutoReply(false);
    }
  };

  const handleSaveSendHour = async () => {
    setSavingSendHour(true);
    try {
      await campaignAPI.updateSendHour(id!, sendHourUTC);
      toast.success(`Preferred send window anchored to ${sendHourUTC}:00 UTC`, 'Saved');
    } catch {
      toast.error('Could not update preferred send hour', 'Error');
    } finally {
      setSavingSendHour(false);
    }
  };

  const handleSaveActiveHours = async () => {
    setSavingActiveHours(true);
    try {
      await campaignAPI.updateActiveHours(id!, {
        activeStartHour: activeStartHour === '' ? null : Number(activeStartHour),
        activeEndHour: activeEndHour === '' ? null : Number(activeEndHour),
        timezone,
      });
      toast.success('Active sending hours and timezone updated', 'Saved');
    } catch {
      toast.error('Could not update active hours window', 'Error');
    } finally {
      setSavingActiveHours(false);
    }
  };

  const handleSaveFollowUpSteps = async () => {
    setSavingSteps(true);
    try {
      await campaignAPI.setFollowUpSteps(
        id!,
        followUpSteps.map(s => ({ stepNumber: s.stepNumber, delayDays: s.delayDays }))
      );
      toast.success('Follow-up sequence timeline persisted', 'Flow Updated');
      await fetchCampaign();
    } catch {
      toast.error('Could not save follow-up sequence', 'Error');
    } finally {
      setSavingSteps(false);
    }
  };

  if (loading) return <div className="py-24 text-center text-xs text-zinc-400">Loading campaign workflow...</div>;
  if (!campaign) return <div className="py-24 text-center text-rose-500">Campaign not found.</div>;

  const analytics = campaign.analytics || {
    totalLeads: campaign.leads?.length || 0,
    contactedCount: 0,
    queuedCount: campaign.queuedCount || 0,
    sentCount: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    bounceRate: 0,
    unsubscribedCount: 0,
  };

  const unsubscribeRate = analytics.sentCount > 0
    ? Number(((analytics.unsubscribedCount / analytics.sentCount) * 100).toFixed(1))
    : 0;

  const getFilteredLeadsForCategory = () => {
    const list = campaign.leads || [];
    const emails = campaign.emails || [];

    switch (drilldownCategory) {
      case 'CONTACTED':
        return list.filter((l: any) => l.outreachStatus === 'SENT' || l.status === 'CONTACTED' || l.status === 'REPLIED');
      case 'OPENED': {
        const openedLeadIds = new Set(emails.filter((e: any) => e.openedAt && !e.isIncoming).map((e: any) => e.leadId));
        return list.filter((l: any) => openedLeadIds.has(l.id));
      }
      case 'CLICKED': {
        const clickedLeadIds = new Set(emails.filter((e: any) => e.clickedAt && !e.isIncoming).map((e: any) => e.leadId));
        return list.filter((l: any) => clickedLeadIds.has(l.id));
      }
      case 'REPLIED': {
        const repliedLeadIds = new Set(emails.filter((e: any) => e.isIncoming).map((e: any) => e.leadId));
        return list.filter((l: any) => l.status === 'REPLIED' || repliedLeadIds.has(l.id));
      }
      case 'BOUNCED':
        return list.filter((l: any) => l.status === 'BOUNCED' || l.outreachStatus === 'BOUNCED');
      case 'UNSUBSCRIBED':
        return list.filter((l: any) => l.status === 'UNSUBSCRIBED');
      case 'ALL':
      default:
        return list;
    }
  };

  const filteredDrilldownLeads = getFilteredLeadsForCategory().filter((l: any) => {
    if (!drilldownSearch.trim()) return true;
    const q = drilldownSearch.toLowerCase();
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.company || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link to="/campaigns" className="text-xs font-bold text-zinc-400 hover:text-zinc-700 flex items-center gap-1 mb-1">
            ← Campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">{campaign.name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              campaign.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700'
                : campaign.status === 'PAUSED'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-zinc-100 text-zinc-600'
            }`}>
              {campaign.status}
            </span>
            {role === 'VIEWER' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">
                👁 View-Only Access
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60">
            {campaign.queuedCount || 0} In Queue
          </span>

          {canEdit && (
            <button
              onClick={() => setIsUploadDrawerOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>+ Upload Leads</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>👥 Invite</span>
            </button>
          )}

          {canEdit && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
                title="Campaign Actions"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={handleTogglePauseResume}
                    className="block w-full text-left px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 border-b border-zinc-100"
                  >
                    {campaign.status === 'PAUSED' ? '▶ Resume Campaign' : '⏸ Pause Campaign'}
                  </button>

                  <button
                    onClick={handleReconcileQueue}
                    disabled={isReconciling}
                    className="block w-full text-left px-4 py-2 text-xs font-medium text-blue-600 hover:bg-zinc-50"
                  >
                    {isReconciling ? 'Reconciling...' : '⚡ Reconcile & Queue Leads'}
                  </button>

                  <button
										onClick={handleRepersonalizeQueue}
										disabled={isRepersonalizing}
										className="block w-full text-left px-4 py-2 text-xs font-medium text-amber-700 hover:bg-zinc-50"
									>
										{isRepersonalizing ? 'Refreshing...' : '🔄 Refresh Queue from Copy Reserves'}
									</button>

                  <button
                    onClick={() => { setShowRenameModal(true); setMenuOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Rename Campaign
                  </button>
                  <button
                    onClick={() => { setShowStrategyModal(true); setMenuOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Refine SDR Strategy
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => { setShowDeleteModal(true); setMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Delete Campaign
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Push-Notification Health Alert Banner */}
      {healthAlerts.length > 0 && (
        <div className="space-y-2">
          {healthAlerts.map((alert, idx) => {
            const isError = alert.severity === 'error';
            const isWarning = alert.severity === 'warning';

            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150 ${
                  isError
                    ? 'bg-rose-50 border-rose-200 text-rose-950'
                    : isWarning
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-blue-50 border-blue-200 text-blue-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                    isError ? 'bg-rose-200 text-rose-800' : isWarning ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'
                  }`}>
                    {isError ? '!' : isWarning ? '⏸' : 'i'}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{alert.title}</p>
                    <p className="text-[11px] opacity-80 mt-0.5">{alert.message}</p>
                  </div>
                </div>

                {alert.actionLabel && (
                  <button
                    onClick={() => handleAlertAction(alert.actionType)}
                    disabled={isDispatchingNow || isReconciling || isRepersonalizing}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap self-end sm:self-center ${
                      isError
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : isWarning
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isDispatchingNow && alert.actionType === 'DISPATCH_NOW'
                      ? 'Sweeping Queue...'
                      : isReconciling && alert.actionType === 'RECONCILE_QUEUE'
                      ? 'Queueing Leads...'
                      : isRepersonalizing && alert.actionType === 'REPERSONALIZE'
                      ? 'Re-Personalizing...'
                      : alert.actionLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="flex space-x-8">
          {[
            ['dashboard', 'Overview & Analytics'],
            ['flow', 'Sequence Flow'],
            ['leads', `Leads (${campaign.leads?.length || 0})`],
            ['drafts', `Copywriting (${campaign.drafts?.length || 0})`],
            ['automation', 'Automation Rules'],
            ['settings', 'Senders & Strategy'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`py-3 px-1 border-b-2 text-xs font-bold transition-colors ${
                activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 0: OVERVIEW & ANALYTICS DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div
              onClick={() => setDrilldownCategory('ALL')}
              className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Total Leads</span>
                <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
              </div>
              <p className="text-xl font-black text-zinc-900 mt-1">{analytics.totalLeads}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">In sequence</p>
            </div>

            <div
              onClick={() => setDrilldownCategory('CONTACTED')}
              className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Contacted</span>
                <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
              </div>
              <p className="text-xl font-black text-zinc-800 mt-1">{analytics.contactedCount}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Sent outreach</p>
            </div>

            <div
              onClick={() => setDrilldownCategory('OPENED')}
              className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Opened</span>
                <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
              </div>
              <p className="text-xl font-black text-blue-600 mt-1">{analytics.openRate}%</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.openedCount} unique</p>
            </div>

            <div
              onClick={() => setDrilldownCategory('CLICKED')}
              className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Clicked</span>
                <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
              </div>
              <p className="text-xl font-black text-purple-600 mt-1">{analytics.clickRate}%</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.clickedCount} clicks</p>
            </div>

            <div
              onClick={() => setDrilldownCategory('REPLIED')}
              className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Replied</span>
                <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
              </div>
              <p className="text-xl font-black text-emerald-600 mt-1">{analytics.replyRate}%</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.replyCount} replies</p>
            </div>

            <div
              onClick={() => setDrilldownCategory('BOUNCED')}
              className="p-4 bg-white border border-zinc-200 hover:border-rose-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-rose-600">Bounce Rate</span>
                <span className="text-zinc-300 group-hover:text-rose-500 text-xs">↗</span>
              </div>
              <p className={`text-xl font-black mt-1 ${analytics.bounceRate > 5 ? 'text-rose-600' : 'text-zinc-900'}`}>
                {analytics.bounceRate}%
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.bounceCount} bounces</p>
            </div>

            <div
              onClick={() => setDrilldownCategory('UNSUBSCRIBED')}
              className="p-4 bg-white border border-zinc-200 hover:border-amber-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-amber-600">Unsubscribe</span>
                <span className="text-zinc-300 group-hover:text-amber-500 text-xs">↗</span>
              </div>
              <p className="text-xl font-black text-amber-600 mt-1">{unsubscribeRate}%</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.unsubscribedCount} opt-outs</p>
            </div>
          </div>

          {/* Sequence Operational Status Card */}
          <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Sequence Operational Status</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Queue status, active mailboxes, and deliverability health.</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReconcileQueue}
                  disabled={isReconciling}
                  className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-colors"
                >
                  {isReconciling ? 'Syncing...' : '⚡ Reconcile Queue'}
                </button>
                <button
                  onClick={handleDispatchNow}
                  disabled={isDispatchingNow || campaign.queuedCount === 0}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
                >
                  {isDispatchingNow ? 'Sweeping...' : 'Trigger Send Sweep'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-zinc-100">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Queue & Status</span>
                <p className="font-bold text-zinc-800 mt-1">{campaign.queuedCount || 0} Emails Waiting ({campaign.status})</p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Sending Mailboxes</span>
                <p className="font-bold text-zinc-800 mt-1">{campaign.senderLinks?.length || 0} Assigned in Rotation</p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Deliverability Health</span>
                <p className="font-bold text-zinc-800 mt-1">{analytics.bounceRate}% Bounce Rate ({analytics.unsubscribedCount} Unsubs)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: VISUAL SEQUENCE FLOW */}
      {activeTab === 'flow' && (
        <div className="space-y-8">
          <SequenceCanvas
						steps={followUpSteps}
						drafts={campaign.drafts || []}
						canEdit={canEdit}
						onAddStep={() => {
							const nextNum = (followUpSteps[followUpSteps.length - 1]?.stepNumber || 0) + 1;
							setFollowUpSteps([...followUpSteps, { stepNumber: nextNum, delayDays: 3 }]);
						}}
						onUpdateDelay={(idx, days) => {
							const next = [...followUpSteps];
							next[idx] = { ...next[idx], delayDays: days };
							setFollowUpSteps(next);
						}}
						onRemoveStep={(idx) => setFollowUpSteps(followUpSteps.filter((_, i) => i !== idx))}
						onGenerateDraft={handleGenerateStepDraft}
						generatingDraftFor={generatingDraftFor}
					/>

          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={handleSaveFollowUpSteps}
                disabled={savingSteps}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {savingSteps ? 'Saving...' : 'Save Sequence Timeline'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LEADS LIST */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Prospects in this Sequence</span>
            {canEdit && (
              <button
                onClick={() => setIsUploadDrawerOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                + Upload Leads to Campaign
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            {(!campaign.leads || campaign.leads.length === 0) ? (
              <div className="py-20 text-center text-xs text-zinc-400 space-y-2">
                <p>No leads attached to this sequence yet.</p>
                {canEdit && (
                  <button
                    onClick={() => setIsUploadDrawerOpen(true)}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Upload and map your first lead list
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-zinc-100 text-left text-xs">
                <thead className="bg-zinc-50/75 text-zinc-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Outreach Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                  {campaign.leads.map((l: any) => (
                    <tr
                      key={l.id}
                      onClick={() => { setPreviewLead(l); setIsLeadDrawerOpen(true); }}
                      className="hover:bg-zinc-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-zinc-900">{l.name}</td>
                      <td className="py-3 px-4 font-mono text-zinc-500">{l.email}</td>
                      <td className="py-3 px-4 text-zinc-600">{l.company || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-zinc-100 text-zinc-700">
                          {l.outreachStatus || l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DRAFTS, DELIVERABILITY GRADER & SPINTAX SIMULATOR */}
      {activeTab === 'drafts' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Copywriting Variations</h3>
            {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateAiDraft}
                  disabled={generatingDraft}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {generatingDraft ? 'Synthesizing...' : '✨ Generate AI Variation'}
                </button>
                <button
                  onClick={() => handleOpenDraftDrawer()}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  + Custom Draft
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(campaign.drafts || []).map((draft: any) => (
              <div key={draft.id} className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    {draft.tone} ({draft.useCase}{draft.stepNumber ? ` #${draft.stepNumber}` : ''})
                  </span>
                  {canEdit && (
                    <div className="flex gap-3 text-xs font-bold">
                      <button onClick={() => handleOpenDraftDrawer(draft)} className="text-blue-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteDraft(draft.id)} className="text-rose-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-bold text-zinc-900">{draft.subject}</h4>
                <p className="text-xs text-zinc-600 whitespace-pre-wrap font-sans line-clamp-4">{draft.body}</p>

                {/* Per-Draft Analytics Data */}
                <div className="p-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between text-[11px] text-zinc-600">
                  <div>Sent: <strong className="text-zinc-900">{draft.sentCount || 0}</strong></div>
                  <div>Opens: <strong className="text-blue-700">{draft.openCount || 0} ({draft.openRate || 0}%)</strong></div>
                  <div>Clicks: <strong className="text-purple-700">{draft.clickCount || 0} ({draft.clickRate || 0}%)</strong></div>
                  <div>Replies: <strong className="text-emerald-700">{draft.replyCount || 0} ({draft.replyRate || 0}%)</strong></div>
                </div>

                <div className="space-y-3 pt-3 border-t border-zinc-100">
                  <DeliverabilityGrader
                    campaignId={campaign.id}
                    subject={draft.subject}
                    body={draft.body}
                  />
                  <SpintaxSimulator subject={draft.subject} body={draft.body} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMATION RULES */}
      {activeTab === 'automation' && (
        <div className="space-y-6">
          {!canEdit && (
            <div className="p-3 bg-zinc-100 rounded-xl text-xs text-zinc-600 font-medium">
              You have view-only access — automation configurations are displayed in read-only mode.
            </div>
          )}

          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs flex items-center justify-between">
            <div className="max-w-xl">
              <h3 className="text-sm font-bold text-zinc-900">Autonomous AI Auto-Reply</h3>
              <p className="text-xs text-zinc-500 mt-1">
                When enabled, incoming replies from leads are analyzed and answered by AI immediately upon receipt.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoReplyEnabled}
                disabled={!canEdit || savingAutoReply}
                onChange={(e) => handleToggleAutoReply(e.target.checked)}
              />
              <div className="w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:bg-blue-600 peer-disabled:opacity-50 transition-colors" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
            </label>
          </div>

          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Preferred Send Hour (UTC)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">The queue worker prefers to schedule new mailbox capacity windows around this hour.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={sendHourUTC}
                disabled={!canEdit}
                onChange={(e) => setSendHourUTC(Number(e.target.value))}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 disabled:opacity-50"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC</option>
                ))}
              </select>
              {canEdit && (
                <button
                  onClick={handleSaveSendHour}
                  disabled={savingSendHour}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
                >
                  {savingSendHour ? 'Saving...' : 'Save Send Hour'}
                </button>
              )}
            </div>
          </div>

          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Active Business Hours Window</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Emails are dispatched strictly during this window in the target prospect timezone. Leave hours blank to allow 24-hour dispatch.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Start Hour (0-23)</label>
                <input
                  type="number" min={0} max={23}
                  value={activeStartHour}
                  disabled={!canEdit}
                  onChange={(e) => setActiveStartHour(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold disabled:opacity-50"
                  placeholder="e.g. 8"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">End Hour (0-23)</label>
                <input
                  type="number" min={0} max={23}
                  value={activeEndHour}
                  disabled={!canEdit}
                  onChange={(e) => setActiveEndHour(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold disabled:opacity-50"
                  placeholder="e.g. 18"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Timezone</label>
                <select
                  value={timezone}
                  disabled={!canEdit}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              {canEdit && (
                <button
                  onClick={handleSaveActiveHours}
                  disabled={savingActiveHours}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
                >
                  {savingActiveHours ? 'Saving...' : 'Save Window'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS, STRATEGY & SENDERS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Assigned Mailboxes (Round-Robin)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Select which active inboxes rotate this campaign's outbound dispatches.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userSenders.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">No senders available. Connect a domain on the Domains page first.</p>
              ) : (
                userSenders.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 p-3.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campaignSenderIds.has(s.id)}
                      onChange={(e) => toggleSender(s.id, e.target.checked)}
                      disabled={!canEdit || updatingSender || s.status !== 'active'}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-0"
                    />
                    <div>
                      <p className="text-xs font-bold text-zinc-900 font-mono">{s.localPart}@{s.domain?.domainName}</p>
                      <p className="text-[11px] text-zinc-400">Limit: {s.dailyLimit}/day · Sent today: {s.sentCountToday}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">SDR Strategy & Conversion Goal</h3>
                <p className="text-xs text-zinc-500 mt-0.5">The core objective guiding AI personalization and objection handling.</p>
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowStrategyModal(true)}
                  className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Edit Strategy
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Primary Objective</span>
                <p className="font-semibold text-zinc-800 mt-0.5">{campaign.objective || 'Not specified'}</p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Target Conversion Tool</span>
                <p className="font-semibold text-zinc-800 mt-0.5">{campaign.targetTool || 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEAD CATEGORY DRILLDOWN DRAWER */}
      <Sheet
        isOpen={Boolean(drilldownCategory)}
        onClose={() => { setDrilldownCategory(null); setDrilldownSearch(''); }}
        title={`Prospects: ${drilldownCategory} (${filteredDrilldownLeads.length})`}
        description="Inspect and search leads in this specific funnel conversion segment."
        width="xl"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={drilldownSearch}
            onChange={(e) => setDrilldownSearch(e.target.value)}
            placeholder="Search leads by name, email, or company..."
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
          />

          {filteredDrilldownLeads.length === 0 ? (
            <p className="py-12 text-center text-xs text-zinc-400">No leads in this category.</p>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              {filteredDrilldownLeads.map((l: any) => (
                <div
                  key={l.id}
                  onClick={() => { setPreviewLead(l); setIsLeadDrawerOpen(true); }}
                  className="p-3 bg-zinc-50 hover:bg-blue-50/60 border border-zinc-200 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-zinc-900">{l.name}</p>
                    <p className="text-[11px] text-zinc-400 font-mono">{l.email}</p>
                    <p className="text-[10px] text-zinc-500">{l.company || 'No Company'} · {l.position || 'No Title'}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700">
                    {l.outreachStatus || l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Sheet>

      {/* In-Campaign Lead Upload Drawer */}
      <Sheet
        isOpen={isUploadDrawerOpen}
        onClose={() => setIsUploadDrawerOpen(false)}
        title={`Import Leads into "${campaign.name}"`}
        description="Ingest, verify, and match fields directly. Ingested leads are queued for outreach immediately."
        width="2xl"
      >
        <UploadArea
          campaignId={campaign.id}
          onJobComplete={() => {
            fetchCampaign();
            setIsUploadDrawerOpen(false);
          }}
        />
      </Sheet>

      {/* Lead Inspector Drawer */}
      <LeadDrawer
        isOpen={isLeadDrawerOpen}
        onClose={() => setIsLeadDrawerOpen(false)}
        lead={previewLead}
        campaignId={campaign.id}
        onUpdate={fetchCampaign}
      />

      {/* Draft Editor Drawer */}
      <Sheet
        isOpen={isDraftDrawerOpen}
        onClose={() => setIsDraftDrawerOpen(false)}
        title={editingDraft ? 'Edit Copywriting Draft' : 'Create Custom Draft'}
        description="Include Spintax {Option A|Option B} and {{name}} or {{company}} placeholders."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Subject Line</label>
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Body Text</label>
            <textarea
              rows={10}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="w-full p-3 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button onClick={() => setIsDraftDrawerOpen(false)} className="px-3 py-1.5 text-xs text-zinc-600">Cancel</button>
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
            >
              {savingDraft ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
      </Sheet>

      {/* Modals */}
      <RenameCampaignModal isOpen={showRenameModal} onClose={() => setShowRenameModal(false)} campaign={campaign} onSuccess={handleUpdate} />
      <DeleteCampaignModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteCampaign} campaignName={campaign.name} />
      <EditStrategyModal isOpen={showStrategyModal} onClose={() => setShowStrategyModal(false)} campaign={campaign} onSuccess={handleUpdate} />
      <InviteCollaboratorModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} campaignId={campaign.id} onSuccess={handleUpdate} />
    </div>
  );
};