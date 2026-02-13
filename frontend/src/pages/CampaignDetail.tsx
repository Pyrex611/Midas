import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { campaignAPI } from '../services/api';
import { LeadEmailPreviewModal } from '../components/LeadEmailPreviewModal';

export const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leads' | 'drafts'>('leads');
  const [previewLead, setPreviewLead] = useState<{
    id: string;
    name: string;
    email: string;
    outreachStatus?: string;
  } | null>(null);

  const fetchCampaign = async () => {
    try {
      const res = await campaignAPI.get(id!);
      setCampaign(res.data);
    } catch (error) {
      console.error('Failed to fetch campaign', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center py-12">Loading campaign details...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center py-12">Campaign not found.</div>
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
            <svg
              className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-800"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
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
      <div className="mb-6">
        <Link to="/campaigns" className="text-blue-600 hover:text-blue-800 flex items-center">
          ← Back to Campaigns
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <div className="mt-2 flex items-center space-x-3">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[campaign.status]}`}>
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
            <p className="mt-2 text-xs text-blue-600">
              This context is used by the AI to tailor email drafts.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{campaign.leads?.length || 0}</div>
            <div className="text-sm text-gray-600">Leads</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{campaign.emails?.length || 0}</div>
            <div className="text-sm text-gray-600">Emails Sent</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{campaign.drafts?.length || 0}</div>
            <div className="text-sm text-gray-600">Drafts</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {campaign.leads?.filter((l: any) => l.outreachStatus === 'SENT').length || 0}
            </div>
            <div className="text-sm text-gray-600">Delivered</div>
          </div>
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
        {activeTab === 'drafts' && campaign.drafts && campaign.drafts.length > 0 && (
          <div className="mt-6 space-y-4">
            {campaign.drafts.map((draft: any) => (
              <div key={draft.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Subject: {draft.subject}</div>
                    <div className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{draft.body}</div>
                  </div>
                  <div className="ml-4 flex flex-col items-end text-xs text-gray-500">
                    <span>Tone: {draft.tone}</span>
                    <span>Use: {draft.useCase}</span>
                    <span>Sent: {draft.sentCount}</span>
                    <span>Replies: {draft.replyCount}</span>
                  </div>
                </div>
              </div>
            ))}
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