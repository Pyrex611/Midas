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
}

export const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await campaignAPI.getAll();
      setCampaigns(res.data);
    } catch (err: any) {
      console.error('Failed to fetch campaigns', err);
      setError(err.response?.data?.error || err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Campaigns</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + New Campaign
        </button>
      </div>

      {loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading campaigns...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error loading campaigns</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchCampaigns}
            className="mt-2 text-sm bg-red-200 px-3 py-1 rounded hover:bg-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No campaigns yet</h3>
          <p className="mt-2 text-gray-600">Get started by creating your first outreach campaign.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create Campaign
          </button>
        </div>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link to={`/campaigns/${campaign.id}`} className="block hover:bg-gray-50 transition-colors">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-medium text-blue-600 truncate">{campaign.name}</p>
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                          {campaign.context || campaign.description || 'No description provided'}
                        </p>
                      </div>
                      <div className="mt-2 sm:mt-0 flex flex-wrap items-center gap-2 sm:gap-4">
                        {getStatusBadge(campaign.status)}
                        <span className="text-sm text-gray-500">
                          {campaign._count.leads} lead{campaign._count.leads !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row sm:justify-between text-xs text-gray-500">
                      <div className="flex flex-wrap gap-2 sm:gap-4">
                        <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                        {campaign.startedAt && (
                          <span>Started {new Date(campaign.startedAt).toLocaleDateString()}</span>
                        )}
                        {campaign.completedAt && (
                          <span>Completed {new Date(campaign.completedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="mt-1 sm:mt-0">
                        {campaign._count.emails} email{campaign._count.emails !== 1 ? 's' : ''} sent
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
          fetchCampaigns();
        }}
      />
    </div>
  );
};