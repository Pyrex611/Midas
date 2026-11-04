import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { campaignAPI, senderAPI, getErrorMessage } from '../services/api';
import { Sheet } from '../components/common/Sheet';
import { SequenceCanvas } from '../components/campaigns/SequenceCanvas';
import { LeadDrawer } from '../components/leads/LeadDrawer';
import { UploadArea } from '../components/UploadArea';
import { RenameCampaignModal } from '../components/RenameCampaignModal';
import { DeleteCampaignModal } from '../components/DeleteCampaignModal';
import { EditStrategyModal } from '../components/EditStrategyModal';
import { InviteCollaboratorModal } from '../components/InviteCollaboratorModal';
import { CampaignHeader } from '../components/campaigns/CampaignHeader';
import { CampaignHealthBanner, HealthAlert } from '../components/campaigns/CampaignHealthBanner';
import { CampaignOverviewTab } from '../components/campaigns/tabs/CampaignOverviewTab';
import { CampaignDraftsTab } from '../components/campaigns/tabs/CampaignDraftsTab';
import { CampaignAutomationTab } from '../components/campaigns/tabs/CampaignAutomationTab';
import { CampaignSettingsTab } from '../components/campaigns/tabs/CampaignSettingsTab';
import { DrilldownDrawer } from '../components/campaigns/DrilldownDrawer';
import { useToast } from '../context/ToastContext';

type TabType = 'dashboard' | 'flow' | 'leads' | 'drafts' | 'automation' | 'settings';
type DrilldownCategory = 'ALL' | 'CONTACTED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'BOUNCED' | 'UNSUBSCRIBED';

export const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const isFirstLoadRef = useRef(true);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Interactive Lead Drilldown Sheet State
  const [drilldownCategory, setDrilldownCategory] = useState<DrilldownCategory | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');

  // Push-Notification Health Alert Banner State
  const [healthAlerts, setHealthAlerts] = useState<HealthAlert[]>([]);
  const [isDispatchingNow, setIsDispatchingNow] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRepersonalizing, setIsRepersonalizing] = useState(false);

  // In-Campaign Direct Upload Drawer
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);

  // Modals State
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Lead Inspector Drawer
  const [previewLead, setPreviewLead] = useState<any | null>(null);
  const [isLeadDrawerOpen, setIsLeadDrawerOpen] = useState(false);

  // Draft Editor Drawer State
  const [isDraftDrawerOpen, setIsDraftDrawerOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  // Senders Rotation State
  const [userSenders, setUserSenders] = useState<any[]>([]);
  const [campaignSenderIds, setCampaignSenderIds] = useState<Set<string>>(new Set());
  const [updatingSender, setUpdatingSender] = useState(false);

  // Automation State
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

  /**
   * FLICKER-FREE REFETCH:
   * Only sets initialLoading on the absolute first mount.
   * All subsequent revalidations run strictly in the background without unmounting the DOM.
   */
  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    if (isFirstLoadRef.current) {
      setInitialLoading(true);
    }

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
      isFirstLoadRef.current = false;
      setInitialLoading(false);
    }
  }, [id, toast]);

  const fetchSenders = useCallback(async () => {
    if (!id) return;
    try {
      const [allRes, assignedRes] = await Promise.all([
        senderAPI.listAll(),
        campaignAPI.getCampaignSenders(id),
      ]);
      setUserSenders(allRes.data || []);
      setCampaignSenderIds(new Set((assignedRes.data || []).map((s: any) => s.id)));
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchCampaign();
    fetchSenders();
  }, [id]);

  // Actions
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
      toast.success(res.data?.message || 'Queue refreshed from active reserves', 'Re-Personalized');
      await fetchCampaign();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not refresh queue from reserves'), 'Error');
    } finally {
      setIsRepersonalizing(false);
    }
  };

  const handleTogglePauseResume = async () => {
    if (!id || !campaign) return;
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
      toast.success(`Dispatched send batch: ${sent} email(s) sent`, 'Batch Sent (≤5)');
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

  const handleToggleSender = async (senderId: string, checked: boolean) => {
    if (!id) return;
    setUpdatingSender(true);
    try {
      if (checked) {
        await campaignAPI.addSenderToCampaign(id, senderId);
        setCampaignSenderIds((prev) => new Set(prev).add(senderId));
        toast.success('Mailbox attached to campaign rotation', 'Sender Active');
      } else {
        await campaignAPI.removeSenderFromCampaign(id, senderId);
        setCampaignSenderIds((prev) => {
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
    if (!id || !draftSubject.trim() || !draftBody.trim()) return;
    setSavingDraft(true);
    try {
      if (editingDraft) {
        await campaignAPI.updateDraft(id, editingDraft.id, { subject: draftSubject, body: draftBody });
        toast.success('Draft variation updated', 'Saved');
      } else {
        await campaignAPI.createCustomDraft(id, { subject: draftSubject, body: draftBody });
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
    if (!id) return;
    if (!confirm('Are you sure you want to delete this draft variation?')) return;
    try {
      await campaignAPI.deleteDraft(id, draftId);
      toast.info('Draft variation deleted', 'Deleted');
      await fetchCampaign();
    } catch {
      toast.error('Could not delete draft', 'Error');
    }
  };

  const handleGenerateAiDraft = async () => {
    if (!id) return;
    setGeneratingDraft(true);
    try {
      await campaignAPI.generateDraft(id);
      toast.success('AI synthesized a fresh tonal draft variation', 'Synthesized');
      await fetchCampaign();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to synthesize draft with active AI provider'), 'AI Error');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleGenerateStepDraft = async (stepNumber: number) => {
    if (!id) return;
    setGeneratingDraftFor(stepNumber);
    try {
      await campaignAPI.generateStepDraft(id, stepNumber);
      toast.success(`Synthesized AI draft for step #${stepNumber}`, 'Complete');
      await fetchCampaign();
    } catch (err: any) {
      toast.error(getErrorMessage(err, `Failed to generate draft for step #${stepNumber}`), 'AI Step Draft Error');
    } finally {
      setGeneratingDraftFor(null);
    }
  };

  const handleToggleAutoReply = async (checked: boolean) => {
    if (!id) return;
    setAutoReplyEnabled(checked);
    setSavingAutoReply(true);
    try {
      await campaignAPI.updateAutoReply(id, { autoReplyEnabled: checked });
      toast.success(`Autonomous AI auto-reply is now ${checked ? 'ACTIVE' : 'PAUSED'}`, 'Auto-Reply');
    } catch {
      setAutoReplyEnabled(!checked);
      toast.error('Could not update auto-reply setting', 'Error');
    } finally {
      setSavingAutoReply(false);
    }
  };

  const handleSaveSendHour = async () => {
    if (!id) return;
    setSavingSendHour(true);
    try {
      await campaignAPI.updateSendHour(id, sendHourUTC);
      toast.success(`Preferred send window anchored to ${sendHourUTC}:00 UTC`, 'Saved');
    } catch {
      toast.error('Could not update preferred send hour', 'Error');
    } finally {
      setSavingSendHour(false);
    }
  };

  const handleSaveActiveHours = async () => {
    if (!id) return;
    setSavingActiveHours(true);
    try {
      await campaignAPI.updateActiveHours(id, {
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
    if (!id) return;
    setSavingSteps(true);
    try {
      await campaignAPI.setFollowUpSteps(
        id,
        followUpSteps.map((s) => ({ stepNumber: s.stepNumber, delayDays: s.delayDays }))
      );
      toast.success('Follow-up sequence timeline persisted', 'Flow Updated');
      await fetchCampaign();
    } catch {
      toast.error('Could not save follow-up sequence', 'Error');
    } finally {
      setSavingSteps(false);
    }
  };

  // ONLY show full loading indicator on cold first-time mount
  if (initialLoading && !campaign) {
    return <div className="py-24 text-center text-xs text-zinc-400">Loading campaign workflow...</div>;
  }
  if (!campaign) {
    return <div className="py-24 text-center text-rose-500">Campaign not found.</div>;
  }

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

  const unsubscribeRate =
    analytics.sentCount > 0 ? Number(((analytics.unsubscribedCount / analytics.sentCount) * 100).toFixed(1)) : 0;

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
      {/* 1. Header Bar */}
      <CampaignHeader
        campaign={campaign}
        role={role}
        canEdit={canEdit}
        canDelete={canDelete}
        onUploadLeadsClick={() => setIsUploadDrawerOpen(true)}
        onInviteClick={() => setShowInviteModal(true)}
        onTogglePauseResume={handleTogglePauseResume}
        onReconcileQueue={handleReconcileQueue}
        onRepersonalizeQueue={handleRepersonalizeQueue}
        onRenameClick={() => setShowRenameModal(true)}
        onStrategyClick={() => setShowStrategyModal(true)}
        onDeleteClick={() => setShowDeleteModal(true)}
        isReconciling={isReconciling}
        isRepersonalizing={isRepersonalizing}
      />

      {/* 2. Health Alerts Push Banner */}
      <CampaignHealthBanner
        alerts={healthAlerts}
        onAction={handleAlertAction}
        isDispatchingNow={isDispatchingNow}
        isReconciling={isReconciling}
        isRepersonalizing={isRepersonalizing}
      />

      {/* 3. Navigation Tabs */}
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
              onClick={() => setActiveTab(key as TabType)}
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
        <CampaignOverviewTab
          analytics={analytics}
          unsubscribeRate={unsubscribeRate}
          campaign={campaign}
          onSelectCategory={(cat) => setDrilldownCategory(cat)}
          onReconcileQueue={handleReconcileQueue}
          onDispatchNow={handleDispatchNow}
          isReconciling={isReconciling}
          isDispatchingNow={isDispatchingNow}
        />
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
                  <button onClick={() => setIsUploadDrawerOpen(true)} className="text-blue-600 font-bold hover:underline">
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
                      onClick={() => {
                        setPreviewLead(l);
                        setIsLeadDrawerOpen(true);
                      }}
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

      {/* TAB 3: DRAFTS & COPYWRITING VARIATIONS */}
      {activeTab === 'drafts' && (
        <CampaignDraftsTab
          campaignId={campaign.id}
          drafts={campaign.drafts || []}
          canEdit={canEdit}
          onGenerateAiDraft={handleGenerateAiDraft}
          onOpenCustomDraftModal={() => handleOpenDraftDrawer()}
          onEditDraft={handleOpenDraftDrawer}
          onDeleteDraft={handleDeleteDraft}
          generatingDraft={generatingDraft}
        />
      )}

      {/* TAB 4: AUTOMATION RULES */}
      {activeTab === 'automation' && (
        <CampaignAutomationTab
          canEdit={canEdit}
          autoReplyEnabled={autoReplyEnabled}
          savingAutoReply={savingAutoReply}
          onToggleAutoReply={handleToggleAutoReply}
          sendHourUTC={sendHourUTC}
          savingSendHour={savingSendHour}
          onSendHourChange={setSendHourUTC}
          onSaveSendHour={handleSaveSendHour}
          activeStartHour={activeStartHour}
          activeEndHour={activeEndHour}
          timezone={timezone}
          savingActiveHours={savingActiveHours}
          onStartHourChange={setActiveStartHour}
          onEndHourChange={setActiveEndHour}
          onTimezoneChange={setTimezone}
          onSaveActiveHours={handleSaveActiveHours}
        />
      )}

      {/* TAB 5: SETTINGS & SENDER ROTATION */}
      {activeTab === 'settings' && (
        <CampaignSettingsTab
          campaign={campaign}
          userSenders={userSenders}
          campaignSenderIds={campaignSenderIds}
          canEdit={canEdit}
          updatingSender={updatingSender}
          onToggleSender={handleToggleSender}
          onEditStrategyClick={() => setShowStrategyModal(true)}
        />
      )}

      {/* DRAWERS & MODALS */}
      <DrilldownDrawer
        isOpen={Boolean(drilldownCategory)}
        onClose={() => {
          setDrilldownCategory(null);
          setDrilldownSearch('');
        }}
        category={drilldownCategory}
        leads={filteredDrilldownLeads}
        searchQuery={drilldownSearch}
        onSearchChange={setDrilldownSearch}
        onLeadClick={(lead) => {
          setPreviewLead(lead);
          setIsLeadDrawerOpen(true);
        }}
      />

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

      <LeadDrawer
        isOpen={isLeadDrawerOpen}
        onClose={() => setIsLeadDrawerOpen(false)}
        lead={previewLead}
        campaignId={campaign.id}
        onUpdate={() => fetchCampaign()}
      />

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

      <RenameCampaignModal isOpen={showRenameModal} onClose={() => setShowRenameModal(false)} campaign={campaign} onSuccess={() => fetchCampaign()} />
      <DeleteCampaignModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteCampaign} campaignName={campaign.name} />
      <EditStrategyModal isOpen={showStrategyModal} onClose={() => setShowStrategyModal(false)} campaign={campaign} onSuccess={() => fetchCampaign()} />
      <InviteCollaboratorModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} campaignId={campaign.id} onSuccess={() => fetchCampaign()} />
    </div>
  );
};