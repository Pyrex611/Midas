import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { campaignAPI, domainAPI } from '../services/api';
import { LeadEmailPreviewModal } from '../components/LeadEmailPreviewModal';
import { RenameCampaignModal } from '../components/RenameCampaignModal';
import { DeleteCampaignModal } from '../components/DeleteCampaignModal';
import { EditDraftModal } from '../components/EditDraftModal';
import { CustomDraftModal } from '../components/CustomDraftModal';
import { EditStrategyModal } from '../components/EditStrategyModal';
import { InviteCollaboratorModal } from '../components/InviteCollaboratorModal';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney',
];

export const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'drafts' | 'automation'>('leads');
  const [previewLead, setPreviewLead] = useState<{
    id: string;
    name: string;
    email: string;
    outreachStatus?: string;
  } | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [showEditDraftModal, setShowEditDraftModal] = useState(false);
  const [showCustomDraftModal, setShowCustomDraftModal] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const [userDomains, setUserDomains] = useState<any[]>([]);
  const [campaignDomainIds, setCampaignDomainIds] = useState<Set<string>>(new Set());
  const [updatingDomain, setUpdatingDomain] = useState(false);

  // --- Automation tab state ---
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
  const [generatingStepDraft, setGeneratingStepDraft] = useState<number | null>(null);

  const role: 'OWNER' | 'EDITOR' | 'VIEWER' = campaign?.role || 'VIEWER';
  const canEdit = role === 'OWNER' || role === 'EDITOR';
  const canDelete = role === 'OWNER';

  const fetchCampaign = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await campaignAPI.get(id);
      setCampaign(res.data);
      setAutoReplyEnabled(res.data.autoReplyEnabled || false);
      setSendHourUTC(res.data.sendHourUTC ?? 9);
      setActiveStartHour(res.data.activeStartHour ?? '');
      setActiveEndHour(res.data.activeEndHour ?? '');
      setTimezone(res.data.timezone || 'UTC');
      setFollowUpSteps((res.data.followUpSteps || []).sort((a: any, b: any) => a.stepNumber - b.stepNumber));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDomains = async () => {
    try {
      const res = await domainAPI.getAll();
      setUserDomains(res.data);
    } catch (err) {
      console.error('Failed to fetch user domains', err);
    }
  };

  const fetchCampaignDomains = async () => {
    if (!id) return;
    try {
      const res = await campaignAPI.getCampaignDomains(id);
      setCampaignDomainIds(new Set(res.data.map((d: any) => d.id)));
    } catch (err) {
      console.error('Failed to fetch campaign domains', err);
    }
  };

  useEffect(() => {
    fetchCampaign();
    fetchUserDomains();
  }, [id]);

  useEffect(() => {
    if (campaign) {
      fetchCampaignDomains();
    }
  }, [campaign?.id]);

  const handleUpdate = () => {
    fetchCampaign();
    fetchCampaignDomains();
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await campaignAPI.delete(id);
      navigate('/campaigns');
    } catch (error) {
      alert('Could not delete campaign');
    }
  };

  const handleGenerateDraft = async () => {
    if (!campaign?.id) return;
    setGeneratingDraft(true);
    try {
      await campaignAPI.generateDraft(campaign.id);
      await fetchCampaign();
    } catch (error) {
      alert('Could not generate draft');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleEditDraft = async (draftId: string, data: { subject: string; body: string }) => {
    if (!campaign?.id) return;
    await campaignAPI.updateDraft(campaign.id, draftId, data);
    await fetchCampaign();
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!campaign?.id) return;
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try {
      await campaignAPI.deleteDraft(campaign.id, draftId);
      await fetchCampaign();
    } catch (error) {
      alert('Could not delete draft');
    }
  };

  const handleCreateCustomDraft = async (data: { subject: string; body: string }) => {
    if (!campaign?.id) return;
    await campaignAPI.createCustomDraft(campaign.id, data);
    await fetchCampaign();
  };

  const toggleDomain = async (domainId: string, checked: boolean) => {
    setUpdatingDomain(true);
    try {
      if (checked) {
        await campaignAPI.addDomainToCampaign(id!, domainId);
        setCampaignDomainIds(prev => new Set(prev).add(domainId));
      } else {
        await campaignAPI.removeDomainFromCampaign(id!, domainId);
        setCampaignDomainIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(domainId);
          return newSet;
        });
      }
    } catch (err) {
      alert('Could not update domain assignment');
    } finally {
      setUpdatingDomain(false);
    }
  };

  // --- Automation tab handlers ---
  const handleToggleAutoReply = async (checked: boolean) => {
    if (!id) return;
    setAutoReplyEnabled(checked); // optimistic
    setSavingAutoReply(true);
    try {
      await campaignAPI.updateAutoReply(id, { autoReplyEnabled: checked });
    } catch (err) {
      setAutoReplyEnabled(!checked);
      alert('Could not update auto-reply setting');
    } finally {
      setSavingAutoReply(false);
    }
  };

  const handleSaveSendHour = async () => {
    if (!id) return;
    setSavingSendHour(true);
    try {
      await campaignAPI.updateSendHour(id, sendHourUTC);
    } catch (err) {
      alert('Could not update send hour');
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
    } catch (err) {
      alert('Could not update active hours');
    } finally {
      setSavingActiveHours(false);
    }
  };

  const addFollowUpStep = () => {
    const nextStepNumber = (followUpSteps[followUpSteps.length - 1]?.stepNumber || 0) + 1;
    setFollowUpSteps([...followUpSteps, { stepNumber: nextStepNumber, delayDays: 3, enabled: true, _isNew: true }]);
  };

  const updateStepDelay = (index: number, delayDays: number) => {
    const next = [...followUpSteps];
    next[index] = { ...next[index], delayDays };
    setFollowUpSteps(next);
  };

  const removeStep = (index: number) => {
    setFollowUpSteps(followUpSteps.filter((_, i) => i !== index));
  };

  const handleSaveFollowUpSteps = async () => {
    if (!id) return;
    setSavingSteps(true);
    try {
      await campaignAPI.setFollowUpSteps(
        id,
        followUpSteps.map(s => ({ stepNumber: s.stepNumber, delayDays: Number(s.delayDays) }))
      );
      await fetchCampaign();
    } catch (err) {
      alert('Could not save follow-up steps');
    } finally {
      setSavingSteps(false);
    }
  };

  const handleGenerateStepDraft = async (stepNumber: number) => {
    if (!id) return;
    setGeneratingStepDraft(stepNumber);
    try {
      await campaignAPI.generateStepDraft(id, stepNumber);
      alert(`Draft generated for follow-up step ${stepNumber}. Check the Email Drafts tab.`);
    } catch (err) {
      alert('Could not generate a draft for this step');
    } finally {
      setGeneratingStepDraft(null);
    }
  };

  if (loading) return <div className="text-center py-20 pt-28">Loading campaign details...</div>;
  if (error || !campaign) return <div className="text-center py-20 text-red-600 pt-28">{error || 'Campaign not found'}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <div className="mb-6 flex justify-between items-center">
        <Link to="/campaigns" className="text-blue-600 hover:text-blue-800 flex items-center">
          ← Back to Campaigns
        </Link>

        <div className="flex items-center gap-3">
          {role === 'VIEWER' && (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
              👁 View-only access
            </span>
          )}

          {canEdit && (
            <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700">
              👥 Invite Collaborator
            </button>
          )}

          {canEdit && (
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-full hover:bg-gray-200">
                <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <button onClick={() => { setShowRenameModal(true); setMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Rename Campaign
                  </button>
                  <button onClick={() => { setShowStrategyModal(true); setMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Edit Strategy
                  </button>
                  {canDelete && (
                    <button onClick={() => { setShowDeleteModal(true); setMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                      Delete Campaign
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <RenameCampaignModal isOpen={showRenameModal} onClose={() => setShowRenameModal(false)} campaign={campaign} onSuccess={handleUpdate} />
      <DeleteCampaignModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete} campaignName={campaign.name} />
      <EditDraftModal isOpen={showEditDraftModal} onClose={() => setShowEditDraftModal(false)} draft={editingDraft} onSave={handleEditDraft} />
      <CustomDraftModal isOpen={showCustomDraftModal} onClose={() => setShowCustomDraftModal(false)} onSubmit={handleCreateCustomDraft} />
      <EditStrategyModal isOpen={showStrategyModal} onClose={() => setShowStrategyModal(false)} campaign={campaign} onSuccess={handleUpdate} />
      <InviteCollaboratorModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} campaignId={campaign.id} onSuccess={handleUpdate} />

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{campaign.description || 'No description provided.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
              {campaign.status}
            </span>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">
              {campaign.queuedCount || 0} Queued
            </span>
          </div>
        </div>

        {/* Sending Domains Assignment */}
        <div className="mt-6 p-4 bg-white border rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sending Subdomains (Round-Robin)</h3>
          <p className="text-sm text-gray-600 mb-4">Select active subdomains to distribute this campaign's email sending volume.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userDomains.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No sending domains configured. <Link to="/domains" className="text-blue-600 underline">Add a domain</Link>.</p>
            ) : (
              userDomains.map((d) => (
                <label key={d.id} className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
                  <input
                    type="checkbox"
                    checked={campaignDomainIds.has(d.id)}
                    onChange={(e) => toggleDomain(d.id, e.target.checked)}
                    disabled={!canEdit || updatingDomain || d.status !== 'active'}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{d.domainName}</p>
                    <p className="text-xs text-gray-500">Sender: {d.senderLocalPart || 'hello'}@{d.domainName} ({d.status.toUpperCase()})</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mt-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('leads')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'leads' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Leads ({campaign.leads?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'drafts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Email Drafts ({campaign.drafts?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('automation')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'automation' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Automation
            </button>
          </nav>
        </div>

        {/* Leads Tab Content */}
        {activeTab === 'leads' && (
          <div className="mt-6 overflow-x-auto">
            {(!campaign.leads || campaign.leads.length === 0) ? (
              <div className="py-12 text-center text-gray-400">No leads attached to this campaign.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outreach Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaign.leads.map((lead: any) => (
                    <tr key={lead.id} onClick={() => setPreviewLead(lead)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{lead.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{lead.company || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-800">
                          {lead.outreachStatus || lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Drafts Tab Content */}
        {activeTab === 'drafts' && (
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-700 uppercase">Copywriting Drafts</h3>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateDraft}
                    disabled={generatingDraft}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generatingDraft ? 'Generating...' : '✨ Generate AI Variation'}
                  </button>
                  <button
                    onClick={() => setShowCustomDraftModal(true)}
                    className="px-3 py-1.5 bg-gray-800 text-white rounded text-xs font-bold hover:bg-gray-900"
                  >
                    + Custom Draft
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(campaign.drafts || []).map((draft: any) => (
                <div key={draft.id} className="border rounded-xl p-4 bg-gray-50 shadow-sm relative">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      Tone: {draft.tone} ({draft.useCase}{draft.stepNumber ? ` #${draft.stepNumber}` : ''})
                    </span>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingDraft(draft); setShowEditDraftModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => handleDeleteDraft(draft.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                      </div>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{draft.subject}</h4>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap font-sans line-clamp-4">{draft.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Automation Tab Content */}
        {activeTab === 'automation' && (
          <div className="mt-6 space-y-8">
            {!canEdit && (
              <div className="p-3 bg-gray-50 border rounded-md text-xs text-gray-500">
                You have view-only access to this campaign — automation settings are shown but can't be changed.
              </div>
            )}

            {/* Auto-reply */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Auto-Reply</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-xl">
                    When enabled, incoming replies are answered automatically by AI as soon as they arrive,
                    with no manual approval step. Leave this off if you want to review and send replies
                    yourself from each lead's thread.
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
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-disabled:opacity-50 transition-colors" />
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            </div>

            {/* Send hour */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-sm font-bold text-gray-900">Preferred Send Hour (UTC)</h3>
              <p className="text-xs text-gray-500 mt-1 mb-3">The queue prefers to start new domain-limit windows around this hour.</p>
              <div className="flex items-center gap-3">
                <select
                  value={sendHourUTC}
                  disabled={!canEdit}
                  onChange={(e) => setSendHourUTC(Number(e.target.value))}
                  className="px-3 py-2 border rounded-md text-sm disabled:opacity-50"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC</option>
                  ))}
                </select>
                {canEdit && (
                  <button
                    onClick={handleSaveSendHour}
                    disabled={savingSendHour}
                    className="px-4 py-2 bg-gray-800 text-white rounded text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                  >
                    {savingSendHour ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>

            {/* Active hours & timezone */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-sm font-bold text-gray-900">Active Sending Window</h3>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Emails only send during this window, in the selected timezone. Leave both hours blank to send
                any time of day.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Start Hour</label>
                  <input
                    type="number" min={0} max={23}
                    value={activeStartHour}
                    disabled={!canEdit}
                    onChange={(e) => setActiveStartHour(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md text-sm disabled:opacity-50"
                    placeholder="e.g. 8"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">End Hour</label>
                  <input
                    type="number" min={0} max={23}
                    value={activeEndHour}
                    disabled={!canEdit}
                    onChange={(e) => setActiveEndHour(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md text-sm disabled:opacity-50"
                    placeholder="e.g. 18"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Timezone</label>
                  <select
                    value={timezone}
                    disabled={!canEdit}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm disabled:opacity-50"
                  >
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                {canEdit && (
                  <button
                    onClick={handleSaveActiveHours}
                    disabled={savingActiveHours}
                    className="px-4 py-2 bg-gray-800 text-white rounded text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                  >
                    {savingActiveHours ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>

            {/* Follow-up sequence */}
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Follow-Up Sequence</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Each step fires automatically the given number of days after the initial email, if the lead
                    hasn't replied yet. A draft (tone: "followup") must exist for a step or it will be skipped.
                  </p>
                </div>
                {canEdit && (
                  <button onClick={addFollowUpStep} className="px-3 py-1.5 bg-gray-800 text-white rounded text-xs font-bold hover:bg-gray-900">
                    + Add Step
                  </button>
                )}
              </div>

              {followUpSteps.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No follow-up steps configured.</p>
              ) : (
                <div className="space-y-2">
                  {followUpSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 border rounded-md">
                      <span className="text-xs font-bold text-gray-500 w-16">Step {step.stepNumber}</span>
                      <span className="text-xs text-gray-500">Send after</span>
                      <input
                        type="number" min={1} max={60}
                        value={step.delayDays}
                        disabled={!canEdit}
                        onChange={(e) => updateStepDelay(i, Number(e.target.value))}
                        className="w-16 px-2 py-1 border rounded text-sm disabled:opacity-50"
                      />
                      <span className="text-xs text-gray-500">days</span>
                      {canEdit && (
                        <div className="ml-auto flex gap-3">
                          <button
                            onClick={() => handleGenerateStepDraft(step.stepNumber)}
                            disabled={generatingStepDraft === step.stepNumber}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {generatingStepDraft === step.stepNumber ? 'Generating...' : '✨ Generate Draft'}
                          </button>
                          <button onClick={() => removeStep(i)} className="text-xs text-red-600 hover:underline">Remove</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <button
                  onClick={handleSaveFollowUpSteps}
                  disabled={savingSteps}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSteps ? 'Saving...' : 'Save Follow-Up Sequence'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <LeadEmailPreviewModal
        isOpen={!!previewLead}
        onClose={() => setPreviewLead(null)}
        campaignId={campaign.id}
        lead={previewLead}
        onSendSuccess={fetchCampaign}
      />
    </div>
  );
};
