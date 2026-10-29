import React, { useEffect, useState, useRef, useCallback } from 'react';
import { adminAPI, userAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';

export const AdminDashboard: React.FC = () => {
  const { toast } = useToast();

  // Operator Clearance State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [verifyingPassphrase, setVerifyingPassphrase] = useState(false);
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(60);

  // Action Protection Modal State
  const [actionTargetDomain, setActionTargetDomain] = useState<{ id: string; name: string; type: 'pause' | 'unpause' } | null>(null);
  const [actionConfirmPassphrase, setActionConfirmPassphrase] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Admin Data State
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lockSession = useCallback(() => {
    sessionStorage.removeItem('midas_operator_token');
    sessionStorage.removeItem('midas_operator_expires_at');
    setIsUnlocked(false);
    window.dispatchEvent(new Event('operator_auth_changed'));
    toast.warning('Operator session locked due to 60 minutes of inactivity', 'Session Expired');
  }, [toast]);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

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
      if (err.response?.status === 403) {
        lockSession();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check if user is already an elevated database admin
    userAPI.getProfile()
      .then(res => {
        if (res.data?.user?.isAdmin) {
          setIsUnlocked(true);
          fetchAll();
          return;
        }

        // 2. Otherwise, check existing operator token in sessionStorage
        const token = sessionStorage.getItem('midas_operator_token');
        const expiresAt = Number(sessionStorage.getItem('midas_operator_expires_at') || 0);

        if (token && expiresAt > Date.now()) {
          setIsUnlocked(true);
          fetchAll();
        }
      })
      .catch(() => {});

    // Activity event listeners
    window.addEventListener('mousemove', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('scroll', recordActivity);
    window.addEventListener('click', recordActivity);

    // Inactivity check every 30 seconds
    inactivityTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, 60 - Math.floor(elapsed / (60 * 1000)));
      setSessionRemainingMinutes(remaining);

      if (elapsed > 60 * 60 * 1000) {
        lockSession();
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('scroll', recordActivity);
      window.removeEventListener('click', recordActivity);
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    };
  }, [lockSession, recordActivity]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseInput.trim()) return;

    setVerifyingPassphrase(true);
    try {
      const res = await adminAPI.unlock(passphraseInput.trim());
      sessionStorage.setItem('midas_operator_token', res.data.token);
      sessionStorage.setItem('midas_operator_expires_at', String(res.data.expiresAt));
      lastActivityRef.current = Date.now();
      setIsUnlocked(true);
      setPassphraseInput('');
      window.dispatchEvent(new Event('operator_auth_changed'));
      toast.success('Operator clearance authorized for 60 minutes', 'Session Active');
      await fetchAll();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Passphrase rejected. Default is midas_operator_2026'), 'Access Denied');
    } finally {
      setVerifyingPassphrase(false);
    }
  };

  const handleExecuteProtectedAction = async () => {
    if (!actionTargetDomain || !actionConfirmPassphrase.trim()) return;

    setSubmittingAction(true);
    try {
      if (actionTargetDomain.type === 'pause') {
        await adminAPI.pauseDomain(actionTargetDomain.id, actionConfirmPassphrase.trim());
        toast.warning(`Circuit breaker armed: ${actionTargetDomain.name} is paused`, 'Action Executed');
      } else {
        await adminAPI.unpauseDomain(actionTargetDomain.id, actionConfirmPassphrase.trim());
        toast.success(`Domain ${actionTargetDomain.name} reactivated`, 'Circuit Cleared');
      }
      setActionTargetDomain(null);
      setActionConfirmPassphrase('');
      await fetchAll();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Action protection passphrase rejected'), 'Unauthorized');
    } finally {
      setSubmittingAction(false);
    }
  };

  // 1. LOCKED OPERATOR CLEARANCE GATEWAY
  if (!isUnlocked) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-zinc-50">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-8 shadow-xl space-y-6 animate-in zoom-in-95 duration-150">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto shadow-md">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">Operator Clearance Required</h2>
            <p className="text-xs text-zinc-500">
              Enter your platform master passphrase to unlock cross-tenant deliverability controls.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Master Passphrase
              </label>
              <input
                type="password"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="••••••••••••••••"
                required
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <p className="text-[10px] text-zinc-400 mt-1">Default passphrase: <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold text-zinc-700">midas_operator_2026</code></p>
            </div>

            <button
              type="submit"
              disabled={verifyingPassphrase}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
            >
              {verifyingPassphrase ? 'Verifying Clearance...' : 'Authenticate Operator'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. UNLOCKED OPERATOR DASHBOARD
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Platform Deliverability Command</h1>
          <p className="text-xs text-zinc-500 mt-1">Cross-tenant operator visibility with step-up action protection.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Session ({sessionRemainingMinutes}m idle lock)</span>
          </div>
          <button
            onClick={lockSession}
            className="px-3 py-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-bold rounded-xl transition-colors"
          >
            Lock Dashboard
          </button>
        </div>
      </div>

      {loading && <div className="py-20 text-center text-xs text-zinc-400">Loading operator metrics...</div>}
      {error && <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">{error}</div>}

      {/* Aggregate Metric Tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ['Users', stats.userCount],
            ['Sequences', stats.campaignCount],
            ['Total Leads', stats.leadCount],
            ['Domains', stats.domainCount],
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
          <h2 className="text-base font-black text-zinc-900 tracking-tight">Cross-Tenant Sending Domains</h2>
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
                <th className="py-3 px-4 text-right">Protected Action</th>
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
                        onClick={() => setActionTargetDomain({ id: d.id, name: d.domainName, type: 'unpause' })}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                      >
                        Reset & Clear
                      </button>
                    ) : (
                      <button
                        onClick={() => setActionTargetDomain({ id: d.id, name: d.domainName, type: 'pause' })}
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
          <h2 className="text-base font-black text-zinc-900 tracking-tight">Active Workspaces</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Tenant resource allocations and permissions.</p>
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
                <th className="py-3 px-4">Joined</th>
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

      {/* Action Protection Step-Up Confirmation Modal */}
      {actionTargetDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setActionTargetDomain(null)} />
          <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-6 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Confirm High-Impact Action</h3>
                <p className="text-xs text-zinc-500">Action Protection is armed for cross-tenant modifications.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
              You are about to <strong className="text-zinc-900 uppercase font-black">{actionTargetDomain.type}</strong> all sending from domain <span className="font-mono font-bold text-blue-600">{actionTargetDomain.name}</span>.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Re-enter Operator Passphrase
              </label>
              <input
                type="password"
                value={actionConfirmPassphrase}
                onChange={(e) => setActionConfirmPassphrase(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setActionTargetDomain(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-600 font-bold hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteProtectedAction}
                disabled={submittingAction || !actionConfirmPassphrase.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
              >
                {submittingAction ? 'Verifying...' : 'Authorize Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};