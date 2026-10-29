import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadAPI, campaignAPI, domainAPI } from '../services/api';
import { UploadArea } from '../components/UploadArea';
import { useToast } from '../context/ToastContext';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [newBlock, setNewBlock] = useState('');
  const [stats, setStats] = useState({ campaignsCount: 0, leadsCount: 0, domainsCount: 0 });

  const fetchBlocklist = async () => {
    try {
      const res = await leadAPI.getBlocklist();
      setBlocklist(res.data || []);
    } catch {
      toast.error('Failed to load suppression blocklist', 'Error');
    }
  };

  const fetchOverviewStats = async () => {
    try {
      const [cRes, lRes, dRes] = await Promise.all([
        campaignAPI.getAll(),
        leadAPI.getAll(1, 1),
        domainAPI.getAll(),
      ]);
      setStats({
        campaignsCount: (cRes.data || []).length,
        leadsCount: lRes.data?.pagination?.total || 0,
        domainsCount: (dRes.data || []).length,
      });
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    fetchBlocklist();
    fetchOverviewStats();
  }, []);

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPattern = newBlock.trim().toLowerCase().replace(/^\*@?/, '').replace(/^@/, '');
    if (!cleanPattern) return;

    try {
      await leadAPI.addBlocklist(cleanPattern);
      toast.success(`Suppression rule added for "${cleanPattern}"`, 'Rule Created');
      setNewBlock('');
      await fetchBlocklist();
    } catch {
      toast.error('Failed to add suppression pattern', 'Error');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await leadAPI.deleteBlocklist(id);
      toast.info('Suppression rule deleted', 'Removed');
      await fetchBlocklist();
    } catch {
      toast.error('Could not delete pattern', 'Error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner & Quick Metric Badges */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Workspace Overview</h1>
          <p className="text-xs text-zinc-500 mt-1">Autonomous outbound control center and global lead suppression rules.</p>
        </div>

        <button
          onClick={() => navigate('/campaigns')}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
        >
          <span>Launch Outreach Sequences →</span>
        </button>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Leads In Database</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.leadsCount}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Verified & staged across campaigns</p>
        </div>
        <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Active Sequences</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.campaignsCount}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Automated SDR follow-up loops</p>
        </div>
        <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Authenticated Domains</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.domainsCount}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Mailbox warmup circuit breakers armed</p>
        </div>
      </div>

      {/* Lead Ingestion Studio Component */}
      <UploadArea onJobComplete={fetchOverviewStats} />

      {/* Global Suppression Blocklist */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-black text-zinc-900 tracking-tight">Global Suppression Rules (Blocklist)</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Emails or domains matching these patterns are discarded immediately during CSV/Excel ingestion. Prevents contacting competitors or churned accounts.
          </p>
        </div>

        <form onSubmit={handleAddBlock} className="flex gap-3">
          <input
            type="text"
            value={newBlock}
            onChange={(e) => setNewBlock(e.target.value)}
            placeholder="e.g. competitor.com, agency.io, or ceo@target.com"
            className="flex-1 px-4 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            + Add Suppression Rule
          </button>
        </form>

        <div className="pt-2">
          {blocklist.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-400 italic bg-zinc-50 rounded-xl border border-zinc-100">
              No active suppression patterns configured.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {blocklist.map((b) => (
                <div key={b.id} className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-zinc-800">{b.pattern}</span>
                  <button
                    onClick={() => handleDeleteBlock(b.id)}
                    className="text-zinc-400 hover:text-rose-600 font-bold p-1 text-[11px]"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};