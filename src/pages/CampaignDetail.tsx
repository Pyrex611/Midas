import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { campaignAPI, domainAPI } from '../services/api';
import { LeadEmailPreviewModal } from '../components/LeadEmailPreviewModal';
import { RenameCampaignModal } from '../components/RenameCampaignModal';
import { DeleteCampaignModal } from '../components/DeleteCampaignModal';
import { EditDraftModal } from '../components/EditDraftModal';
import { CustomDraftModal } from '../components/CustomDraftModal';

export const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'drafts'>('leads');
  const [previewLead, setPreviewLead] = useState<{
    id: string;
    name: string;
    email: string;
    outreachStatus?: string;
  } | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [showEditDraftModal, setShowEditDraftModal] = useState(false);
  const [showCustomDraftModal, setShowCustomDraftModal] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const [followUpSteps, setFollowUpSteps] = useState<any[]>([]);
  const [sendHourUTC, setSendHourUTC] = useState(9);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [showFollowUpSteps, setShowFollowUpSteps] = useState(false);
  const [showActiveHours, setShowActiveHours] = useState(false);

  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [updatingAutoReply, setUpdatingAutoReply] = useState(false);

  const [draftFilter, setDraftFilter] = useState<'all' | 'initial' | number>('all');

  const [userDomains, setUserDomains] = useState<any[]>([]);
  const [campaignDomainIds, setCampaignDomainIds] = useState<Set<string>>(new Set());
  const [updatingDomain, setUpdatingDomain] = useState(false);

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
  }, [campaign]);

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
      if (typeof draftFilter === 'number') {
        await campaignAPI.generateStepDraft(campaign.id, draftFilter);
      } else {
        await campaignAPI.generateDraft(campaign.id);
      }
      fetchCampaign();
    } catch (error) {
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
      alert('Could not delete draft');
    }
  };

  const handleCreateCustomDraft = async (data: { subject: string; body: string }) => {
    if (!campaign?.id) return;
    await campaignAPI.createCustomDraft(campaign.id, data);
    fetchCampaign();
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

  if (loading) return <div className="text-center py-20 pt-28">Loading campaign details...</div>;
  if (error || !campaign) return <div className="text-center py-20 text-red-600 pt-28">{error || 'Campaign not found'}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <div className="mb-6 flex justify-between items-center">
        <Link to="/campaigns" className="text-blue-600 hover:text-blue-800 flex items-center">
          ← Back to Campaigns
        </Link>

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
              <button onClick={() => { setShowDeleteModal(true); setMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                Delete Campaign
              </button>
            </div>
          )}
        </div>
      </div>

      <RenameCampaignModal isOpen={showRenameModal} onClose={() => setShowRenameModal(false)} campaign={campaign} onSuccess={handleUpdate} />
      <DeleteCampaignModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete} campaignName={campaign.name} />
      <EditDraftModal isOpen={showEditDraftModal} onClose={() => setShowEditDraftModal(false)} draft={editingDraft} onSave={handleEditDraft} />
      <CustomDraftModal isOpen={showCustomDraftModal} onClose={() => setShowCustomDraftModal(false)} onSubmit={handleCreateCustomDraft} />

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>

        <div className="mt-6 p-4 bg-white border rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Sending Subdomains</h3>
          <p className="text-sm text-gray-600 mb-4">Select which active domains send emails for this campaign (round-robin).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userDomains.map((d) => (
              <label key={d.id} className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={campaignDomainIds.has(d.id)}
                  onChange={(e) => toggleDomain(d.id, e.target.checked)}
                  disabled={updatingDomain || d.status !== 'active'}
                  className="h-4 w-4 text-blue-600"
                />
                <div>
                  <p className="text-sm font-medium">{d.domainName}</p>
                  <p className="text-xs text-gray-500">Status: {d.status.toUpperCase()}</p>
                </div>
              </label>
            ))}
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
          </nav>
        </div>

        {activeTab === 'leads' && campaign.leads && (
          <div className="mt-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaign.leads.map((lead: any) => (
                  <tr key={lead.id} onClick={() => setPreviewLead(lead)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 text-sm text-gray-900">{lead.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{lead.email}</td>
                    <td className="px-4 py-3 text-sm">{lead.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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