import React, { useEffect, useState } from 'react';
import { adminAPI, getErrorMessage } from '../services/api';

export const AdminDashboard: React.FC = () => {
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
      setUsers(usersRes.data);
      setDomains(domainsRes.data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load admin data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handlePause = async (id: string) => {
    try {
      await adminAPI.pauseDomain(id);
      await fetchAll();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Could not pause domain'));
    }
  };

  const handleUnpause = async (id: string) => {
    try {
      await adminAPI.unpauseDomain(id);
      await fetchAll();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Could not unpause domain'));
    }
  };

  if (loading) return <div className="text-center py-20 pt-28">Loading admin view...</div>;
  if (error) return <div className="text-center py-20 text-red-600 pt-28">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Platform Overview</h1>
      <p className="text-sm text-gray-500 mb-8">Cross-tenant visibility — every domain's send reputation is shared platform-wide, so one bad account here is everyone's problem.</p>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            ['Users', stats.userCount],
            ['Campaigns', stats.campaignCount],
            ['Leads', stats.leadCount],
            ['Domains', stats.domainCount],
            ['Sent Today', stats.sentToday],
            ['Queued', stats.pendingCount],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-white shadow rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{value as number}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">All Domains</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Domain</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Owner</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Bounce</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Complaint</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Senders</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {domains.map(d => (
                <tr key={d.id}>
                  <td className="px-3 py-2 font-mono">{d.domainName}</td>
                  <td className="px-3 py-2 text-gray-500">{d.user?.email}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.status === 'active' ? 'bg-green-100 text-green-800' : d.status === 'paused_health_risk' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{(d.bounceRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">{(d.complaintRate * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2">{d.senders?.length || 0}</td>
                  <td className="px-3 py-2 text-right">
                    {d.status === 'paused_health_risk' ? (
                      <button onClick={() => handleUnpause(d.id)} className="text-xs text-green-600 hover:underline">Unpause</button>
                    ) : (
                      <button onClick={() => handlePause(d.id)} className="text-xs text-red-600 hover:underline">Pause</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">All Users</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Campaigns</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Leads</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Domains</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.email}{u.isAdmin && <span className="ml-2 text-xs text-purple-600 font-semibold">ADMIN</span>}</td>
                  <td className="px-3 py-2">{u._count.campaigns}</td>
                  <td className="px-3 py-2">{u._count.leads}</td>
                  <td className="px-3 py-2">{u._count.domains}</td>
                  <td className="px-3 py-2 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
