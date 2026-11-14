import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { leadAPI, campaignAPI } from '../services/api';
import { Lead } from '../types/lead';
import { LeadDrawer } from '../components/leads/LeadDrawer';
import { Pagination } from '../components/Pagination';
import { AddToCampaignModal } from '../components/AddToCampaignModal';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

export const Leads: React.FC = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignFilter = searchParams.get('campaign') || 'all';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await campaignAPI.getAll();
      setCampaigns(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeads = async (page = pagination.page, size = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await leadAPI.getAll(
        page,
        size,
        undefined,
        campaignFilter !== 'all' ? campaignFilter : undefined
      );
      setLeads(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load leads', 'Fetch Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    fetchLeads(1, pagination.pageSize);
  }, [campaignFilter, pagination.pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await leadAPI.delete(id);
      toast.success('Lead removed', 'Deleted');
      fetchLeads(pagination.page);
    } catch {
      toast.error('Failed to delete lead', 'Error');
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => leadAPI.delete(id)));
      toast.success(`Deleted ${count} leads`, 'Success');
      setSelectedIds(new Set());
      fetchLeads(pagination.page);
    } catch {
      toast.error('Could not delete some leads', 'Error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header with Golden Bottom Separator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gold-500/40">
        <div>
          <h1 className="text-2xl font-black text-royal-950 tracking-tight">Leads Command Hub</h1>
          <p className="text-xs text-thistle-500 mt-1">Manage, verify, and inspect prospective buyers across all active sequences.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={campaignFilter}
            onChange={(e) => {
              const val = e.target.value;
              setSearchParams(val === 'all' ? {} : { campaign: val });
            }}
            className="px-3 py-1.5 bg-white border border-gold-500/40 rounded-xl text-xs font-semibold text-royal-950 shadow-xs focus:outline-none focus:border-gold-500"
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <span className="text-xs font-bold text-royal-800 bg-white px-3 py-1.5 rounded-xl border border-gold-500/40">
            {pagination.total} Total
          </span>
        </div>
      </div>

      {/* Floating Action Bar upon multi-selection */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-royal-950 text-white rounded-2xl border border-gold-500/45 shadow-xl flex items-center justify-between animate-in fade-in duration-150">
          <span className="text-xs font-bold pl-2">{selectedIds.size} lead(s) selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddToCampaignModal(true)}
              className="px-3 py-1.5 btn-royal text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Icons.Campaigns className="text-gold-300" />
              <span>Add to Campaign</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
            >
              <Icons.Trash />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Modern Data Grid */}
      <div className="bg-white rounded-2xl border border-gold-500/40 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 text-center text-xs text-thistle-500">Loading leads data grid...</div>
        ) : leads.length === 0 ? (
          <div className="py-24 text-center text-xs text-thistle-500">No leads match this filter criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gold-500/25 text-left text-xs">
              <thead className="bg-thistle-100/75 text-royal-800 font-bold uppercase tracking-wider border-b border-gold-500/35">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === leads.length && leads.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-thistle-400 text-royal-700 focus:ring-0"
                    />
                  </th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Outreach</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-500/20 font-medium text-royal-950">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => handleRowClick(lead)}
                    className="hover:bg-thistle-50/80 cursor-pointer transition-colors"
                  >
                    <td className="p-4" onClick={(e) => toggleSelect(lead.id, e)}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => {}}
                        className="rounded border-thistle-400 text-royal-700 focus:ring-0"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-royal-950">{lead.name}</p>
                      <p className="text-[11px] text-thistle-500 font-mono">{lead.email}</p>
                    </td>
                    <td className="py-3 px-4 text-royal-950/75">{lead.company || '—'}</td>
                    <td className="py-3 px-4 text-thistle-500">{lead.position || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-thistle-100 text-royal-800 border border-gold-500/30">
                        {lead.outreachStatus || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-royal-700 text-white">
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => handleDelete(lead.id, e)}
                        className="text-thistle-500 hover:text-rose-600 text-xs transition-colors p-1"
                        title="Delete lead"
                      >
                        <Icons.Trash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-gold-500/35">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => fetchLeads(page, pagination.pageSize)}
          />
        </div>
      </div>

      <LeadDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lead={selectedLead}
        campaignId={campaignFilter !== 'all' ? campaignFilter : undefined}
        onUpdate={() => fetchLeads(pagination.page)}
      />

      <AddToCampaignModal
        isOpen={showAddToCampaignModal}
        onClose={() => setShowAddToCampaignModal(false)}
        leadIds={Array.from(selectedIds)}
        availableCampaigns={campaigns}
        onSuccess={() => {
          setSelectedIds(new Set());
          fetchLeads(pagination.page);
          toast.success('Leads added to sequence', 'Campaign Updated');
        }}
      />
    </div>
  );
};