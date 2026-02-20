import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LeadsTable } from '../components/LeadsTable';
import { Pagination } from '../components/Pagination';
import { AddToCampaignModal } from '../components/AddToCampaignModal';
import { leadAPI, campaignAPI } from '../services/api';
import { Lead } from '../types/lead';

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignFilter = searchParams.get('campaign') || 'all';
  const campaignIdParam = searchParams.get('campaign') || undefined;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([]);

  // Fetch campaigns for dropdown
  useEffect(() => {
    campaignAPI.getAll().then(res => setCampaigns(res.data)).catch(err => console.error(err));
  }, []);

  const fetchLeads = async (page = pagination.page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await leadAPI.getAll(
        page,
        pagination.pageSize,
        undefined,
        campaignFilter !== 'all' ? campaignFilter : undefined
      );
      setLeads(res.data.data);
      setPagination(res.data.pagination);
    } catch (err: any) {
      console.error('Failed to fetch leads', err);
      setError(err.response?.data?.error || err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  // Poll campaign status without full refresh
  useEffect(() => {
    if (campaignIdParam) {
      const interval = setInterval(async () => {
        try {
          const res = await campaignAPI.get(campaignIdParam);
          setCampaignStatus(res.data);
          setLeads(prevLeads =>
            prevLeads.map(lead => {
              const updated = res.data.leads?.find((l: any) => l.id === lead.id);
              return updated ? { ...lead, outreachStatus: updated.outreachStatus } : lead;
            })
          );
        } catch (error) {
          console.error('Failed to fetch campaign status', error);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [campaignIdParam]);

  useEffect(() => {
    fetchLeads(1);
  }, [campaignFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await leadAPI.delete(id);
      fetchLeads(pagination.page);
    } catch (error) {
      alert('Failed to delete lead');
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} lead(s)?`)) return;
    try {
      await Promise.all(ids.map(id => leadAPI.delete(id)));
      fetchLeads(pagination.page);
    } catch (error) {
      alert('Failed to delete some leads');
    }
  };

  const handleBulkCampaign = async (ids: string[]) => {
    setSelectedLeadIds(ids);
    try {
      const res = await campaignAPI.getAll();
      setAvailableCampaigns(res.data);
      setShowCampaignModal(true);
    } catch (error) {
      console.error('Failed to fetch campaigns', error);
      alert('Could not load campaigns');
    }
  };

  const handleCampaignSuccess = (campaignId: string) => {
    setShowCampaignModal(false);
    navigate(`/leads?campaign=${campaignId}`);
  };

  const handleCampaignFilterChange = (value: string) => {
    if (value === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ campaign: value });
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Leads</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="campaign-filter" className="text-sm text-gray-600">Filter:</label>
            <select
              id="campaign-filter"
              value={campaignFilter}
              onChange={(e) => handleCampaignFilterChange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c._count?.leads || 0} leads)
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">Total: {pagination.total} leads</div>
        </div>
      </div>

      {loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading leads...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error loading leads</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => fetchLeads(1)}
            className="mt-2 text-sm bg-red-200 px-3 py-1 rounded hover:bg-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">No leads found.</p>
        </div>
      )}

      {!loading && !error && leads.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <LeadsTable
            leads={leads}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onBulkCampaign={handleBulkCampaign}
            showOutreachStatus={true}
            campaignStatus={campaignStatus}
          />
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => fetchLeads(page)}
          />
        </div>
      )}

      <AddToCampaignModal
        isOpen={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        leadIds={selectedLeadIds}
        availableCampaigns={availableCampaigns}
        onSuccess={handleCampaignSuccess}
        onRefresh={async () => {
          const res = await campaignAPI.getAll();
          setAvailableCampaigns(res.data);
        }}
      />
    </div>
  );
};