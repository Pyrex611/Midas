import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LeadsTable } from '../components/LeadsTable';
import { Pagination } from '../components/Pagination';
import { leadAPI, campaignAPI } from '../services/api';
import { Lead } from '../types/lead';

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign');
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<any>(null);

  // Fetch leads with pagination
  const fetchLeads = async (page = pagination.page) => {
    setLoading(true);
    try {
      const res = await leadAPI.getAll(page, pagination.pageSize);
      setLeads(res.data.data);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error('Failed to fetch leads', error);
    } finally {
      setLoading(false);
    }
  };

  // If a campaign is running, poll its status every 2 seconds
  useEffect(() => {
    if (campaignId) {
      const interval = setInterval(async () => {
        try {
          const res = await campaignAPI.get(campaignId);
          setCampaignStatus(res.data);
          // Refresh leads to show updated outreachStatus
          fetchLeads(pagination.page);
        } catch (error) {
          console.error('Failed to fetch campaign status', error);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [campaignId, pagination.page]);

  // Initial load
  useEffect(() => {
    fetchLeads(1);
  }, []);

  // Single lead delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await leadAPI.delete(id);
      fetchLeads(pagination.page);
    } catch (error) {
      alert('Failed to delete lead');
    }
  };

  // Bulk delete
  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} lead(s)?`)) return;
    try {
      await Promise.all(ids.map(id => leadAPI.delete(id)));
      fetchLeads(pagination.page);
    } catch (error) {
      alert('Failed to delete some leads');
    }
  };

  // Bulk add to campaign
  const handleBulkCampaign = async (ids: string[]) => {
    try {
      const res = await campaignAPI.create(ids);
      // Navigate to leads page with campaign ID to start polling
      navigate(`/leads?campaign=${res.data.campaignId}`);
    } catch (error) {
      console.error('Failed to start campaign', error);
      alert('Could not start campaign. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          All Leads
          {campaignId && campaignStatus && (
            <span className="ml-4 text-sm font-normal text-gray-500">
              Campaign: {campaignStatus.name} – {campaignStatus.status}
            </span>
          )}
        </h1>
        <div className="text-sm text-gray-500">
          Total: {pagination.total} leads
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading leads...</p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};