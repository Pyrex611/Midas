import React, { useEffect, useState } from 'react';
import { adminAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';

export const AdminDashboard: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, domainsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.listUsers(),
        adminAPI.listDomains(),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data || []);
      setDomains(domainsRes.data || []);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to load operator metrics');
      setError(msg);
      toast.error(msg, 'Access Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handlePause = async (id: string) => {
    try {
      await adminAPI.pauseDomain(id);
      toast.warning('Domain paused due to deliverability risk', 'Circuit Breaker Armed');
      await fetchAll();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not pause domain'), 'Action Failed');
    }
  };

  const handleUnpause = async (id: string) => {
    try {
      await adminAPI.unpauseDomain(id);
      toast.success('Domain reactivated and reset to healthy state', 'Circuit Cleared');
      await fetchAll();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not unpause domain'), 'Action Failed');
    }
  };

  if (loading) return <div className="py-24 text-center text-xs text-zinc-400">Loading operator dashboard...</div>;
  if (error) return <div className="py-24 text-center text-xs text-rose-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Platform Deliverability Command</h1>
        <p className="text-xs text-zinc-500 mt-1">Cross-tenant operator visibility. Monitor shared IP pool reputation and trigger emergency pause switches.</p>
      </div>

      {/* Aggregate Metric Tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ['Registered Users', stats.userCount],
            ['Active Sequences', stats.campaignCount],
            ['Staged Leads', stats.leadCount],
            ['Sending Domains', stats.domainCount],
            ['Sent Today', stats.sentToday],
            ['In Queue', stats.pendingCount],
          ].map(([label, value]) => (
            <div key={label as string} className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs text-center">
              <p className="text-2xl font-black text-zinc-900">{value as number}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cross-Tenant Domains Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-black text-zinc-900 tracking-tight">Cross-Tenant Domain Health</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Automated circuit breakers trigger auto-pause at &gt;5% bounce rate or &gt;0.3% complaint rate.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-left text-xs">
            <thead className="bg-zinc-50/75 text-zinc-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Bounce</th>
                <th className="py-3 px-4">Complaint</th>
                <th className="py-3 px-4">Mailboxes</th>
                <th className="py-3 px-4 text-right">Emergency Circuit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50/80">
                  <td className="py-3 px-4 font-mono font-bold text-zinc-900">{d.domainName}</td>
                  <td className="py-3 px-4 text-zinc-500">{d.user?.email}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      d.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : d.status === 'paused_health_risk'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">{((d.bounceRate || 0) * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 font-mono">{((d.complaintRate || 0) * 100).toFixed(2)}%</td>
                  <td className="py-3 px-4 font-bold">{d.senders?.length || 0} Senders</td>
                  <td className="py-3 px-4 text-right">
                    {d.status === 'paused_health_risk' ? (
                      <button
                        onClick={() => handleUnpause(d.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                      >
                        Reset & Clear
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePause(d.id)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                      >
                        Trip Breaker (Pause)
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Overview Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-black text-zinc-900 tracking-tight">Active User Workspaces</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Tenant resource allocations and role permissions.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-left text-xs">
            <thead className="bg-zinc-50/75 text-zinc-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Sequences</th>
                <th className="py-3 px-4">Leads</th>
                <th className="py-3 px-4">Domains</th>
                <th className="py-3 px-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/80">
                  <td className="py-3 px-4 font-bold text-zinc-900">{u.email}</td>
                  <td className="py-3 px-4">
                    {u.isAdmin ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">OPERATOR ADMIN</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">MEMBER</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{u._count?.campaigns || 0}</td>
                  <td className="py-3 px-4">{u._count?.leads || 0}</td>
                  <td className="py-3 px-4">{u._count?.domains || 0}</td>
                  <td className="py-3 px-4 text-zinc-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};