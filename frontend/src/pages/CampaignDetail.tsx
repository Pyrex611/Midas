import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { campaignAPI, mailboxAPI } from '../services/api';
import { LeadEmailPreviewModal } from '../components/LeadEmailPreviewModal';
import { RenameCampaignModal } from '../components/RenameCampaignModal';
import { DeleteCampaignModal } from '../components/DeleteCampaignModal';
import { EditDraftModal } from '../components/EditDraftModal';
import { CustomDraftModal } from '../components/CustomDraftModal';
import { InviteCollaboratorModal } from '../components/InviteCollaboratorModal';
import { EditStrategyModal } from '../components/EditStrategyModal';

export const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'leads' | 'drafts' | 'team' | 'strategy'>('leads');
	const [showStrategyModal, setShowStrategyModal] = useState(false);
	const [showInviteModal, setShowInviteModal] = useState(false);
  const [previewLead, setPreviewLead] = useState<{
    id: string;
    name: string;
    email: string;
    outreachStatus?: string;
  } | null>(null);

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Draft management state
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [showEditDraftModal, setShowEditDraftModal] = useState(false);
  const [showCustomDraftModal, setShowCustomDraftModal] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  // Follow‑up steps state
  const [followUpSteps, setFollowUpSteps] = useState<any[]>([]);
  const [sendHourUTC, setSendHourUTC] = useState(9);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [showFollowUpSteps, setShowFollowUpSteps] = useState(false);
  const [showActiveHours, setShowActiveHours] = useState(false);

  // Auto‑reply settings state
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [updatingAutoReply, setUpdatingAutoReply] = useState(false);

  // Drafts filter state
  const [draftFilter, setDraftFilter] = useState<'all' | 'initial' | number>('all');

  // Mailbox selection state
  const [userMailboxes, setUserMailboxes] = useState<any[]>([]);
  const [campaignMailboxIds, setCampaignMailboxIds] = useState<Set<string>>(new Set());
  const [updatingMailbox, setUpdatingMailbox] = useState(false);

  const fetchCampaign = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await campaignAPI.get(id);
      setCampaign(res.data);
      setAutoReplyEnabled(res.data.autoReplyEnabled || false);
      setSendHourUTC(res.data.sendHourUTC || 9);
      setFollowUpSteps(res.data.followUpSteps || []);
    } catch (err: any) {
      console.error('Failed to fetch campaign', err);
      if (err.response?.status === 404) {
        setError('Campaign not found.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to load campaign');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserMailboxes = async () => {
    try {
      const res = await mailboxAPI.getAll();
      setUserMailboxes(res.data);
    } catch (err) {
      console.error('Failed to fetch user mailboxes', err);
    }
  };

  const fetchCampaignMailboxes = async () => {
    if (!id) return;
    try {
      const res = await campaignAPI.getCampaignMailboxes(id);
      setCampaignMailboxIds(new Set(res.data.map((m: any) => m.id)));
    } catch (err) {
      console.error('Failed to fetch campaign mailboxes', err);
    }
  };

  const fetchFollowUpSteps = async () => {
    if (!campaign?.id) return;
    try {
      const res = await campaignAPI.getFollowUpSteps(campaign.id);
      setFollowUpSteps(res.data);
    } catch (err) {
      console.error('Failed to load follow‑up steps', err);
    }
  };

  useEffect(() => {
    fetchCampaign();
    fetchUserMailboxes();
  }, [id]);

  useEffect(() => {
    if (campaign) {
      fetchCampaignMailboxes();
      fetchFollowUpSteps();
    }
  }, [campaign]);

  const handleUpdate = () => {
    fetchCampaign();
    fetchCampaignMailboxes();
    fetchFollowUpSteps();
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await campaignAPI.delete(id);
      navigate('/campaigns');
    } catch (error) {
      console.error('Failed to delete campaign', error);
      alert('Could not delete campaign');
    }
  };

  const handleGenerateDraft = async () => {
    if (!campaign?.id) return;
    setGeneratingDraft(true);
    try {
      if (typeof draftFilter === 'number') {
        // Generate follow‑up draft for the selected step
        await campaignAPI.generateStepDraft(campaign.id, draftFilter);
      } else {
        // Generate outreach draft
        await campaignAPI.generateDraft(campaign.id);
      }
      fetchCampaign();
    } catch (error) {
      console.error('Failed to generate draft', error);
      alert('Could not generate draft');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleEditDraft = async (draftId: string, data: { subject: string; body: string }) => {
    if (!campaign?.id) return;
    await campaignAPI.updateDraft(campaign.id, draftId, data);
    fetchCampaign();
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!campaign?.id) return;
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try {
      await campaignAPI.deleteDraft(campaign.id, draftId);
      fetchCampaign();
    } catch (error) {
      console.error('Failed to delete draft', error);
      alert('Could not delete draft');
    }
  };

  const handleCreateCustomDraft = async (data: { subject: string; body: string }) => {
    if (!campaign?.id) return;
    await campaignAPI.createCustomDraft(campaign.id, data);
    fetchCampaign();
  };

  const handleAddStep = () => {
    const newStep = {
      stepNumber: followUpSteps.length + 1,
      delayDays: 1,
      draftId: null,
    };
    setFollowUpSteps([...followUpSteps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    setFollowUpSteps(followUpSteps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: string, value: any) => {
    const newSteps = [...followUpSteps];
    newSteps[index][field] = value;
    setFollowUpSteps(newSteps);
  };

  const saveSteps = async () => {
    setLoadingSteps(true);
    try {
      await campaignAPI.setFollowUpSteps(campaign.id, followUpSteps);
      alert('Follow‑up steps saved');
    } catch (err) {
      console.error('Failed to save steps', err);
      alert('Could not save follow‑up steps');
    } finally {
      setLoadingSteps(false);
    }
  };

  const handleUpdateAutoReply = async () => {
    if (!campaign?.id) return;
    setUpdatingAutoReply(true);
    try {
      await campaignAPI.updateAutoReply(campaign.id, { autoReplyEnabled });
      alert('Auto‑reply setting updated');
    } catch (error) {
      console.error('Failed to update auto‑reply', error);
      alert('Could not update auto‑reply');
    } finally {
      setUpdatingAutoReply(false);
    }
  };

  const handleSendHourChange = async (hour: number) => {
    if (!campaign?.id) return;
    try {
      await campaignAPI.updateSendHour(campaign.id, hour);
      setSendHourUTC(hour);
    } catch (err) {
      console.error('Failed to update send hour', err);
    }
  };

  const toggleMailbox = async (mailboxId: string, checked: boolean) => {
    setUpdatingMailbox(true);
    try {
      if (checked) {
        await campaignAPI.addMailboxToCampaign(id!, mailboxId);
        setCampaignMailboxIds(prev => new Set(prev).add(mailboxId));
      } else {
        await campaignAPI.removeMailboxFromCampaign(id!, mailboxId);
        setCampaignMailboxIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(mailboxId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Failed to update campaign mailboxes', err);
      alert('Could not update mailboxes');
    } finally {
      setUpdatingMailbox(false);
    }
  };

  // Helper to get draft label
  const getDraftLabel = (draft: any): string => {
    if (draft.useCase === 'initial') return 'Outreach';
    if (draft.useCase === 'followup') {
    if (draft.stepNumber) return `Follow-up ${draft.stepNumber}`;
    
    // Fallback for legacy step-linked drafts
    const step = followUpSteps.find(s => s.draftId === draft.id);
    if (step) return `Follow-up ${step.stepNumber}`;
    
    return 'Follow-up (Global)';
    }
    return 'Draft';
  };

  // Filter drafts based on selected filter
  const filteredDrafts = campaign?.drafts?.filter((draft: any) => {
    if (draftFilter === 'all') return true;
    if (draftFilter === 'initial') return draft.useCase === 'initial';
		
		if (typeof draftFilter === 'number') {
			return draft.useCase === 'followup' && draft.stepNumber === draftFilter;
		}
		
		return false;
  }) || [];

  // Get all follow‑up drafts for the dropdown
  const followUpDrafts = campaign?.drafts?.filter((d: any) => d.useCase === 'followup') || [];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error loading campaign</p>
          <p className="text-sm">{error || 'Campaign not found.'}</p>
          <Link to="/campaigns" className="mt-2 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    ACTIVE: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  const getOutreachBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            ⏳ Pending
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-800" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Optimising & personalising…
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center">
            ✈️ Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center">
            ✗ Failed
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            – Skipped
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">—</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <div className="mb-6 flex justify-between items-center">
        <Link to="/campaigns" className="text-blue-600 hover:text-blue-800 flex items-center">
          ← Back to Campaigns
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-full hover:bg-gray-200 focus:outline-none"
          >
            <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
              <button
                onClick={() => { setShowRenameModal(true); setMenuOpen(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Rename Campaign
              </button>
              <button
                onClick={() => { setShowDeleteModal(true); setMenuOpen(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Delete Campaign
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <RenameCampaignModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        campaign={campaign}
        onSuccess={handleUpdate}
      />
      <DeleteCampaignModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        campaignName={campaign.name}
      />
      <EditDraftModal
        isOpen={showEditDraftModal}
        onClose={() => setShowEditDraftModal(false)}
        draft={editingDraft}
        onSave={handleEditDraft}
      />
      <CustomDraftModal
        isOpen={showCustomDraftModal}
        onClose={() => setShowCustomDraftModal(false)}
        onSubmit={handleCreateCustomDraft}
      />

      {/* Campaign details */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <div className="mt-2 flex items-center space-x-3">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[campaign.status] || 'bg-gray-100'}`}>
                {campaign.status}
              </span>
              <span className="text-sm text-gray-500">
                Created {new Date(campaign.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {campaign.description && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-medium text-gray-700">Description</h3>
            <p className="mt-1 text-gray-600">{campaign.description}</p>
          </div>
        )}

        {campaign.context && (
          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <h3 className="text-sm font-medium text-blue-800">Campaign Goal / Context</h3>
            <p className="mt-1 text-blue-700">{campaign.context}</p>
          </div>
        )}

        {/* Sender Name Display */}
        {campaign.senderName && (
          <div className="mt-2 flex items-center">
            <span className="text-sm text-gray-600 mr-2">Sender:</span>
            <span className="text-sm font-medium">{campaign.senderName}</span>
          </div>
        )}

        {/* Mailbox Selection Card */}
        <div className="mt-4 p-4 bg-white border rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Sending Mailboxes</h3>
          <p className="text-sm text-gray-600 mb-4">
            Select which mailboxes will be used to send emails from this campaign. The system will distribute emails among them (round‑robin).
          </p>
          {updatingMailbox && <p className="text-sm text-blue-600 mb-2">Updating...</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userMailboxes.map((mb) => (
              <label key={mb.id} className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={campaignMailboxIds.has(mb.id)}
                  onChange={(e) => toggleMailbox(mb.id, e.target.checked)}
                  disabled={updatingMailbox}
                  className="h-4 w-4 text-blue-600"
                />
                <div>
                  <p className="text-sm font-medium">{mb.name}</p>
                  <p className="text-xs text-gray-500">{mb.email}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{campaign.leads?.length || 0}</div>
            <div className="text-sm text-gray-600">Leads</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{campaign.emails?.length || 0}</div>
            <div className="text-sm text-gray-600">Emails Sent</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{campaign.queuedCount || 0}</div>
            <div className="text-sm text-gray-600">Queued</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{campaign.drafts?.length || 0}</div>
            <div className="text-sm text-gray-600">Drafts</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {campaign.leads?.filter((l: any) => l?.outreachStatus === 'SENT').length || 0}
            </div>
            <div className="text-sm text-gray-600">Delivered</div>
          </div>
        </div>

        {/* Auto‑Reply Card */}
        <div className="mt-4 p-4 bg-white border rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Automatic Replies</h3>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoReplyEnabled"
                checked={autoReplyEnabled}
                onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoReplyEnabled" className="text-sm text-gray-700">
                Enable automatic replies
              </label>
            </div>
          </div>
          {autoReplyEnabled && (
            <p className="text-xs text-gray-500 mb-3">
              When a lead replies, the system will automatically generate and send a response based on sentiment analysis.
            </p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleUpdateAutoReply}
              disabled={updatingAutoReply}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updatingAutoReply ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Settings */}
        <div className="mt-4 border-t pt-4">
          <button
            onClick={() => setShowFollowUpSteps(!showFollowUpSteps)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-lg font-medium text-gray-900">Follow‑up Steps</h3>
            <svg className={`h-5 w-5 transform transition-transform ${showFollowUpSteps ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showFollowUpSteps && (
            <div className="mt-4 p-4 bg-white border rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 mb-4">
                Configure multiple follow‑up emails to be sent after the initial outreach. Each step's delay is in days from the initial email.
              </p>

              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">Send time (UTC hour)</label>
                <select
                  value={sendHourUTC}
                  onChange={(e) => handleSendHourChange(parseInt(e.target.value))}
                  className="border rounded-md px-3 py-2 text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00 UTC</option>
                  ))}
                </select>
              </div>

              {followUpSteps.map((step, index) => (
								<div key={index} className="flex items-center space-x-2 mb-2 border-b pb-2">
									<span className="text-sm font-medium w-16">Step {step.stepNumber}</span>
									<input
										type="number"
										min="1"
										value={step.delayDays}
										onChange={(e) => handleStepChange(index, 'delayDays', parseInt(e.target.value) || 1)}
										className="w-20 px-2 py-1 border rounded-md text-sm"
									/>
									<span className="text-sm text-gray-600">days after initial</span>

									{/* Draft info and generate button */}
									<div className="flex items-center flex-1">
										{step.draftCount !== undefined ? (
											<span className="text-sm text-gray-700">
												{step.draftCount} draft{step.draftCount !== 1 ? 's' : ''} available
											</span>
										) : (
											<span className="text-sm text-gray-400">No drafts yet</span>
										)}
										<button
											onClick={() => handleGenerateStepDraft(step.stepNumber)}
											className="ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
										>
											+ Generate
										</button>
									</div>

									<button
										onClick={() => handleRemoveStep(index)}
										className="text-red-600 hover:text-red-800"
									>
										✕
									</button>
								</div>
							))}

              <button
                onClick={handleAddStep}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                + Add Follow‑up Step
              </button>

              <div className="flex justify-end mt-4">
                <button
                  onClick={saveSteps}
                  disabled={loadingSteps}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loadingSteps ? 'Saving...' : 'Save Steps'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 border-t pt-4">
          <button
            onClick={() => setShowActiveHours(!showActiveHours)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-lg font-medium text-gray-900">Active Sending Hours</h3>
            <svg className={`h-5 w-5 transform transition-transform ${showActiveHours ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showActiveHours && (
            <div className="mt-4 p-4 bg-white border rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 mb-4">
                Emails will only be sent during this time window (UTC). Leave blank to send anytime.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600">Start Hour (UTC)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={campaign.activeStartHour ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      setCampaign({ ...campaign, activeStartHour: val });
                    }}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., 9"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">End Hour (UTC)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={campaign.activeEndHour ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      setCampaign({ ...campaign, activeEndHour: val });
                    }}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., 17"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Timezone</label>
                  <select
                    value={campaign.timezone || 'UTC'}
                    onChange={(e) => setCampaign({ ...campaign, timezone: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Denver">America/Denver</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                    <option value="Asia/Shanghai">Asia/Shanghai</option>
                    <option value="Australia/Sydney">Australia/Sydney</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={async () => {
                    try {
                      await campaignAPI.updateActiveHours(campaign.id, {
                        activeStartHour: campaign.activeStartHour,
                        activeEndHour: campaign.activeEndHour,
                        timezone: campaign.timezone,
                      });
                      alert('Active hours updated');
                    } catch (err) {
                      alert('Failed to update');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Save Hours
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mt-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('leads')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'leads'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Leads ({campaign.leads?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'drafts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Email Drafts ({campaign.drafts?.length || 0})
            </button>
						<button
							onClick={() => setActiveTab('team')}
							className={`py-2 px-1 border-b-2 font-medium text-sm ${
								activeTab === 'team' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
							}`}
						>
							Team & Access
						</button>
						<button
							onClick={() => setActiveTab('strategy')}
							className={`py-4 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-all ${
								activeTab === 'strategy' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
							}`}
						>
							Strategy & DNA
						</button>
          </nav>
        </div>

        {/* Leads Tab */}
        {activeTab === 'leads' && campaign.leads && campaign.leads.length > 0 && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outreach</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaign.leads.map((lead: any) => (
                    <tr
                      key={lead.id}
                      onClick={() =>
                        setPreviewLead({
                          id: lead.id,
                          name: lead.name,
                          email: lead.email,
                          outreachStatus: lead.outreachStatus,
                        })
                      }
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{lead.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100">
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{getOutreachBadge(lead.outreachStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Drafts Tab */}
        {activeTab === 'drafts' && (
          <div className="mt-6">
            {/* Filter bar */}
            <div className="mb-4 flex space-x-2 border-b pb-2">
              <button
                onClick={() => setDraftFilter('all')}
                className={`px-3 py-1 text-sm rounded-md ${
                  draftFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDraftFilter('initial')}
                className={`px-3 py-1 text-sm rounded-md ${
                  draftFilter === 'initial' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Outreach
              </button>
              {followUpSteps.map((step) => (
                <button
                  key={step.stepNumber}
                  onClick={() => setDraftFilter(step.stepNumber)}
                  className={`px-3 py-1 text-sm rounded-md ${
                    draftFilter === step.stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Follow‑up {step.stepNumber}
                </button>
              ))}
            </div>

            {filteredDrafts.length > 0 ? (
              <div className="space-y-4">
                {filteredDrafts.map((draft: any) => (
									<div key={draft.id} className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-all relative">
										{/* Header: Label and Tone - Improved for Small Screens */}
										<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
											<div className="flex items-center gap-2">
												<span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
													{getDraftLabel(draft)}
												</span>
												<span className="text-gray-500 text-xs italic">{draft.tone}</span>
											</div>
											
											{/* Stats pill - Visible on all screens */}
											<div className="flex items-center bg-gray-100 rounded-lg px-2 py-1 text-[10px] text-gray-600 font-medium">
												📤 {draft.sentCount} sent • 💬 {draft.replyCount} replies
											</div>
										</div>

										{/* Content Area */}
										<div className="space-y-2">
											<h4 className="text-sm font-bold text-gray-900 leading-tight">
												<span className="text-gray-400 font-normal mr-1 text-xs uppercase">Subject:</span> 
												{draft.subject || '(No Subject)'}
											</h4>
											
											{/* Body: Limit height on mobile, full on desktop */}
											<div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
												<p className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed line-clamp-4 sm:line-clamp-none">
													{draft.body}
												</p>
											</div>
										</div>

										{/* Actions: Floating or Bottom Bar for Mobile */}
										<div className="mt-4 flex items-center justify-end gap-3 border-t pt-3">
											<button
												onClick={() => { setEditingDraft(draft); setShowEditDraftModal(true); }}
												className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 p-2"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
												Edit
											</button>
											<button
												onClick={() => handleDeleteDraft(draft.id)}
												className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 p-2"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
												Delete
											</button>
										</div>
									</div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No drafts match the selected filter.</p>
            )}

            {/* Draft action buttons */}
            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={handleGenerateDraft}
                disabled={generatingDraft}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {generatingDraft ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  '+ Generate Draft'
                )}
              </button>
              <button
                onClick={() => setShowCustomDraftModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                + Custom Draft
              </button>
            </div>
          </div>
        )}
      </div>
			
			{/* Team Tab */}
			{activeTab === 'team' && (
				<div className="mt-6 space-y-6">
					<div className="flex justify-between items-center">
						<h3 className="text-lg font-medium">Campaign Members</h3>
						<button 
							onClick={() => setShowInviteModal(true)}
							className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
						>
							+ Invite Member
						</button>
					</div>
					
					<div className="bg-white border rounded-lg overflow-hidden">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{campaign.members?.map((member: any) => (
									<tr key={member.id}>
										<td className="px-6 py-4 text-sm">{member.user.email}</td>
										<td className="px-6 py-4 text-sm font-semibold">{member.role}</td>
										<td className="px-6 py-4 text-right">
											{member.role !== 'OWNER' && (
												<button className="text-red-600 hover:text-red-900 text-sm">Remove</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
			
			{activeTab === 'strategy' && (
				<div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
					<div className="bg-white border-2 border-gray-100 rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
						<div className="absolute top-0 right-0 p-8">
							 <button 
								 onClick={() => setShowStrategyModal(true)}
								 className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-100 transition-all"
							 >
								 Edit Strategy
							 </button>
						</div>

						<div className="max-w-2xl">
							<h3 className="text-2xl font-black text-gray-900 mb-6 italic">Campaign Blueprint</h3>
							
							<div className="space-y-8">
								<section>
									<h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Global Objective</h4>
									<p className="text-xl font-bold text-gray-800">{campaign.objective || 'Not defined'}</p>
								</section>

								<section>
									<h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Conversion Tool</h4>
									<div className="inline-block bg-blue-600 text-white px-4 py-2 rounded-xl font-mono font-bold shadow-md shadow-blue-100">
										{campaign.targetTool || 'None Provided'}
									</div>
								</section>

								<section>
									<h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Follow-up Methodology</h4>
									<div className="space-y-3">
										{campaign.followUpSteps?.map((step: any) => (
											<div key={step.id} className="flex gap-4 items-start bg-gray-50 p-4 rounded-2xl border border-gray-100">
												<div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center font-black text-blue-600 shadow-sm border border-gray-100">
													{step.stepNumber}
												</div>
												<div>
													<p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">T+{step.delayDays} Days</p>
													<p className="text-sm font-semibold text-gray-700 leading-snug">{step.microObjective}</p>
												</div>
											</div>
										))}
									</div>
								</section>
							</div>
						</div>
					</div>
				</div>
			)}

      <LeadEmailPreviewModal
        isOpen={!!previewLead}
        onClose={() => setPreviewLead(null)}
        campaignId={campaign.id}
        lead={previewLead}
        onSendSuccess={fetchCampaign}
      />
			
			<InviteCollaboratorModal 
				isOpen={showInviteModal} 
				onClose={() => setShowInviteModal(false)}
				campaignId={campaign.id}
				onSuccess={fetchCampaign}
			/>
			
			<EditStrategyModal 
				isOpen={showStrategyModal} 
				onClose={() => setShowStrategyModal(false)}
				campaign={campaign}
				onSuccess={fetchCampaign}
			/>
    </div>
  );
};