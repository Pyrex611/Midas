import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { campaignAPI } from '../services/api';
import { CreateCampaignModal } from '../components/CreateCampaignModal';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  context: string | null;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  _count: {
    leads: number;
    emails: number;
    drafts: number;
  };
  members?: { role: string }[];
}

export const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel fetch for campaigns and invitations
      const [campRes, inviteRes] = await Promise.all([
        campaignAPI.getAll(),
        campaignAPI.getMyInvites()
      ]);
      setCampaigns(campRes.data);
      setInvites(inviteRes.data);
    } catch (err: any) {
      console.error('Failed to fetch campaigns or invites', err);
      setError(err.response?.data?.error || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleAcceptInvite = async (token: string) => {
    setAcceptingToken(token);
    try {
      await campaignAPI.acceptInvite(token);
      // Re-fetch to show the new campaign in the list and remove the invite box
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setAcceptingToken(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
      
      {/* 1. Pending Invites Section */}
      {invites.length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pending Invitations</h2>
          {invites.map((invite) => (
            <div key={invite.id} className="bg-white border-l-4 border-blue-500 shadow-sm rounded-r-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 p-2 rounded-full">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-900">
                    <span className="font-bold">{invite.sender?.name || invite.sender?.email}</span> invited you to join
                    <span className="font-bold text-blue-600"> "{invite.campaign?.name}"</span>
                  </p>
                  <p className="text-xs text-gray-500">Role: {invite.role}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleAcceptInvite(invite.token)}
                  disabled={!!acceptingToken}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
                >
                  {acceptingToken === invite.token ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Joining...
                    </>
                  ) : (
                    'Accept & Join'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Campaigns</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + New Campaign
        </button>
      </div>

      {/* 3. Loading State */}
      {loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading your dashboard...</p>
        </div>
      )}

      {/* 4. Error State */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error loading campaigns</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchAllData}
            className="mt-2 text-sm bg-red-200 px-3 py-1 rounded hover:bg-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* 5. Empty State */}
      {!loading && !error && campaigns.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No campaigns yet</h3>
          <p className="mt-2 text-gray-600">Get started by creating your first outreach campaign or wait for an invitation.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
          >
            Create Campaign
          </button>
        </div>
      )}

      {/* 6. Campaigns List */}
      {!loading && !error && campaigns.length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link to={`/campaigns/${campaign.id}`} className="block hover:bg-gray-50 transition-colors">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-medium text-blue-600 truncate flex items-center gap-2">
                          {campaign.name}
                          {/* Role Badge if they are just a member */}
                          {campaign.members && campaign.members[0]?.role !== 'OWNER' && (
                            <span className="bg-purple-100 text-purple-700 text-[10px] uppercase px-2 py-0.5 rounded font-bold">
                              {campaign.members[0].role}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-gray-600 line-clamp-1 italic">
                          {campaign.context || campaign.description || 'No description provided'}
                        </p>
                      </div>
                      <div className="mt-2 sm:mt-0 flex flex-wrap items-center gap-2 sm:gap-4">
                        {getStatusBadge(campaign.status)}
                        <span className="text-sm text-gray-500 font-medium">
                          {campaign._count.leads} Leads
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row sm:justify-between text-xs text-gray-400">
                      <div className="flex flex-wrap gap-2 sm:gap-4">
                        <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                        {campaign.startedAt && (
                          <span className="text-green-600 font-medium">Active since: {new Date(campaign.startedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="mt-1 sm:mt-0 font-medium text-gray-500">
                        🚀 {campaign._count.emails} total emails sent
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchAllData();
        }}
      />
    </div>
  );
};