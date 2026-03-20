import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LeadsTable } from '../components/LeadsTable';
import { Pagination } from '../components/Pagination';
import { AddToCampaignModal } from '../components/AddToCampaignModal';
import { leadAPI, campaignAPI } from '../services/api';
import { Lead } from '../types/lead';

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignFilter = searchParams.get('campaign') || 'all';
  const campaignIdParam = searchParams.get('campaign') || undefined;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20, // Default starts at 20
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

  /**
   * Modified fetchLeads to accept explicit page and size
   */
  const fetchLeads = async (page = pagination.page, size = pagination.pageSize) => {
    setLoading(true);
    setError(null);
    try {
      const res = await leadAPI.getAll(
        page,
        size,
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

  // Poll campaign status (unchanged)
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

  /**
   * Refetch when Campaign Filter OR Page Size changes
   */
  useEffect(() => {
    fetchLeads(1, pagination.pageSize);
  }, [campaignFilter, pagination.pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize, page: 1 }));
    // The useEffect above will trigger the actual fetch
  };

  // Handlers (Delete, Bulk Delete, etc. - same as before)
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await leadAPI.delete(id);
      fetchLeads(pagination.page, pagination.pageSize);
    } catch (error) {
      alert('Failed to delete lead');
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} lead(s)?`)) return;
    try {
      await Promise.all(ids.map(id => leadAPI.delete(id)));
      fetchLeads(pagination.page, pagination.pageSize);
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
      alert('Could not load campaigns');
    }
  };

  const handleCampaignSuccess = (campaignId: string) => {
    setShowCampaignModal(false);
    navigate(`/leads?campaign=${campaignId}`);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Leads</h1>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Campaign Filter */}
          <div className="flex items-center space-x-2">
            <label htmlFor="campaign-filter" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Campaign:</label>
            <select
              id="campaign-filter"
              value={campaignFilter}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') setSearchParams({});
                else setSearchParams({ campaign: val });
              }}
              className="border-2 border-gray-100 rounded-xl px-3 py-1.5 text-sm focus:border-blue-500 outline-none transition-all font-medium text-gray-700 bg-white"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 🔥 NEW: Page Size Dropdown */}
          <div className="flex items-center space-x-2">
            <label htmlFor="page-size" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Show:</label>
            <select
              id="page-size"
              value={pagination.pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="border-2 border-gray-100 rounded-xl px-3 py-1.5 text-sm focus:border-blue-500 outline-none transition-all font-bold text-gray-700 bg-white"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            {pagination.total} Total
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white shadow rounded-2xl p-12 text-center text-gray-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-sm font-medium">Fetching leads...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-2xl mb-4 flex justify-between items-center">
          <span className="text-sm font-bold">{error}</span>
          <button onClick={() => fetchLeads(1)} className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg font-bold">Retry</button>
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div className="bg-white shadow rounded-2xl p-12 text-center text-gray-400 border-2 border-dashed">
          No leads found in this segment.
        </div>
      )}

      {!loading && !error && leads.length > 0 && (
        <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
          <LeadsTable
            leads={leads}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onBulkCampaign={handleBulkCampaign}
            showOutreachStatus={true}
            campaignStatus={campaignStatus}
          />
          <div className="p-4 border-t border-gray-50">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => fetchLeads(page, pagination.pageSize)}
            />
          </div>
        </div>
      )}

      <AddToCampaignModal
        isOpen={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        leadIds={selectedLeadIds}
        availableCampaigns={availableCampaigns}
        onSuccess={handleCampaignSuccess}
      />
    </div>
  );
};