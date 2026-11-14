import React, { useEffect, useState, useRef, useCallback } from 'react';
import { adminAPI, userAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

export const AdminDashboard: React.FC = () => {
  const { toast } = useToast();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [verifyingPassphrase, setVerifyingPassphrase] = useState(false);
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(60);

  const [servicesHealth, setServicesHealth] = useState<any>(null);
  const [probingServices, setProbingServices] = useState(false);

  const [actionTargetDomain, setActionTargetDomain] = useState<{ id: string; name: string; type: 'pause' | 'unpause' } | null>(null);
  const [actionConfirmPassphrase, setActionConfirmPassphrase] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

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

  const fetchServicesHealth = async () => {
    setProbingServices(true);
    try {
      const res = await adminAPI.getServicesHealth();
      setServicesHealth(res.data);
    } catch {} finally {
      setProbingServices(false);
    }
  };

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
      await fetchServicesHealth();
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
    userAPI.getProfile()
      .then(res => {
        if (res.data?.user?.isAdmin) {
          setIsUnlocked(true);
          fetchAll();
          return;
        }

        const token = sessionStorage.getItem('midas_operator_token');
        const expiresAt = Number(sessionStorage.getItem('midas_operator_expires_at') || 0);

        if (token && expiresAt > Date.now()) {
          setIsUnlocked(true);
          fetchAll();
        }
      })
      .catch(() => {});

    window.addEventListener('mousemove', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('scroll', recordActivity);
    window.addEventListener('click', recordActivity);

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
      toast.error(getErrorMessage(err, 'Passphrase rejected.'), 'Access Denied');
    } finally {
      setVerifyingPassphrase(false);
    }
  };

  const handleClearLock = async (lockName: string) => {
    try {
      await adminAPI.clearLock(lockName);
      toast.success(`Cleared lock for "${lockName}"`, 'Lock Released');
      await fetchServicesHealth();
    } catch {
      toast.error('Could not clear cron lock', 'Error');
    }
  };

  const handleExecuteProtectedAction = async () => {
    if (!actionTargetDomain || !actionConfirmPassphrase.trim()) return;

    setSubmittingAction(true);
    try {
      if (actionTargetDomain.type === 'pause') {
        await adminAPI.pauseDomain(actionTargetDomain.id, actionConfirmPassphrase.trim());
        toast.warning(`Circuit breaker armed: ${actionTargetDomain.name} paused`, 'Action Executed');
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

  if (!isUnlocked) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-thistle-canvas">
        <div className="w-full max-w-md card-midas rounded-3xl p-8 shadow-xl space-y-6 animate-in zoom-in-95 duration-150">
          <div className="w-12 h-12 rounded-2xl bg-royal-700 text-gold-300 border border-gold-400/50 flex items-center justify-center mx-auto shadow-md">
            <Icons.Lock className="text-xl" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-royal-950 tracking-tight">Operator Clearance Required</h2>
            <p className="text-xs text-thistle-500">
              Enter your platform master passphrase to unlock cross-tenant deliverability controls.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-thistle-500 uppercase tracking-wider mb-1">
                Master Passphrase
              </label>
              <input
                type="password"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="••••••••••••••••"
                required
                className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm font-mono text-royal-950 focus:outline-none focus:border-gold-500"
                autoFocus
              />
              <p className="text-[10px] text-thistle-500 mt-1">
                Default passphrase: <code className="bg-thistle-100 px-1.5 py-0.5 rounded font-mono font-bold text-royal-800 border border-gold-500/30">midas_operator_2026</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={verifyingPassphrase}
              className="w-full py-2.5 btn-royal text-xs font-bold rounded-xl"
            >
              {verifyingPassphrase ? 'Verifying Clearance...' : 'Authenticate Operator'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner with Golden Separator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gold-500/40">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-royal-950 tracking-tight">Platform Deliverability Command</h1>
          <p className="text-xs text-thistle-500 mt-1">Cross-tenant operator visibility, live infrastructure telemetry, and circuit breaker controls.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Session ({sessionRemainingMinutes}m idle lock)</span>
          </div>
          <button
            onClick={lockSession}
            className="px-3 py-1.5 border border-gold-500/40 bg-white text-royal-800 hover:bg-thistle-100 text-xs font-bold rounded-xl transition-colors"
          >
            Lock Dashboard
          </button>
        </div>
      </div>

      {loading && <div className="py-20 text-center text-xs text-thistle-500">Loading operator metrics...</div>}
      {error && <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-700">{error}</div>}

      {/* Core Infrastructure Telemetry */}
      <div className="card-midas rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gold-500/35">
          <div>
            <h2 className="text-base font-black text-royal-950 tracking-tight">Core Infrastructure Telemetry</h2>
            <p className="text-xs text-thistle-500 mt-0.5">Live operational status across database compute, AI provider endpoints, and worker locks.</p>
          </div>
          <button
            onClick={fetchServicesHealth}
            disabled={probingServices}
            className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.Bolt className="text-gold-300" />
            <span>{probingServices ? 'Probing Services...' : 'Probe All Services'}</span>
          </button>
        </div>

        {servicesHealth && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-xs">
            <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-thistle-500">Database Engine</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  servicesHealth.database?.status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {servicesHealth.database?.status || 'UNKNOWN'}
                </span>
              </div>
              <p className="font-bold text-royal-950">Neon Serverless PostgreSQL</p>
              <p className="text-[11px] text-thistle-500">
                Ping Latency: <strong className="text-royal-950 font-mono">{servicesHealth.database?.latencyMs ?? '—'} ms</strong>
              </p>
            </div>

            <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-thistle-500">AI Synthesis Engine</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  servicesHealth.aiEngine?.status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                }`}>
                  {servicesHealth.aiEngine?.status || 'DEGRADED'}
                </span>
              </div>
              <p className="font-bold text-royal-950">
                Provider: <span className="uppercase text-royal-700 font-mono">{servicesHealth.aiEngine?.configuredProvider || 'mock'}</span>
              </p>
              <p className="text-[11px] text-thistle-500">
                {servicesHealth.aiEngine?.latencyMs
                  ? `Response Latency: ${servicesHealth.aiEngine.latencyMs} ms`
                  : servicesHealth.aiEngine?.errorDetail
                  ? `Rejection: ${servicesHealth.aiEngine.errorDetail.substring(0, 45)}...`
                  : 'Operating on built-in Mock provider'}
              </p>
            </div>

            <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-2">
              <span className="text-[10px] font-bold uppercase text-thistle-500">Worker CronLocks</span>
              <div className="space-y-1">
                {(servicesHealth.cronLocks || []).map((lock: any) => {
                  const isLocked = Boolean(lock.lockedAt);
                  return (
                    <div key={lock.name} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold text-royal-950">{lock.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          isLocked ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {isLocked ? 'LOCKED' : 'FREE'}
                        </span>
                        {isLocked && (
                          <button
                            onClick={() => handleClearLock(lock.name)}
                            className="text-[9px] text-rose-600 font-bold hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

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
            <div key={label as string} className="p-4 card-midas rounded-2xl text-center">
              <p className="text-2xl font-black text-royal-950">{value as number}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cross-Tenant Domains Table */}
      <div className="card-midas rounded-2xl p-6 space-y-4">
        <div className="pb-3 border-b border-gold-500/35">
          <h2 className="text-base font-black text-royal-950 tracking-tight">Cross-Tenant Sending Domains</h2>
          <p className="text-xs text-thistle-500 mt-0.5">Automated circuit breakers trigger auto-pause at &gt;5% bounce rate or &gt;0.3% complaint rate.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gold-500/25 text-left text-xs">
            <thead className="bg-thistle-100/75 text-royal-800 font-bold uppercase tracking-wider border-b border-gold-500/35">
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
            <tbody className="divide-y divide-gold-500/20 font-medium text-royal-950">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-thistle-50/80">
                  <td className="py-3 px-4 font-mono font-bold text-royal-950">{d.domainName}</td>
                  <td className="py-3 px-4 text-thistle-500">{d.user?.email}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      d.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : d.status === 'paused_health_risk'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-800'
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
                        Reset &amp; Clear
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
      <div className="card-midas rounded-2xl p-6 space-y-4">
        <div className="pb-3 border-b border-gold-500/35">
          <h2 className="text-base font-black text-royal-950 tracking-tight">Active Workspaces</h2>
          <p className="text-xs text-thistle-500 mt-0.5">Tenant resource allocations and permissions.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gold-500/25 text-left text-xs">
            <thead className="bg-thistle-100/75 text-royal-800 font-bold uppercase tracking-wider border-b border-gold-500/35">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Sequences</th>
                <th className="py-3 px-4">Leads</th>
                <th className="py-3 px-4">Domains</th>
                <th className="py-3 px-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold-500/20 font-medium text-royal-950">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-thistle-50/80">
                  <td className="py-3 px-4 font-bold text-royal-950">{u.email}</td>
                  <td className="py-3 px-4">
                    {u.isAdmin ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-royal-700 text-white">OPERATOR ADMIN</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-thistle-100 text-royal-800">MEMBER</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{u._count?.campaigns || 0}</td>
                  <td className="py-3 px-4">{u._count?.leads || 0}</td>
                  <td className="py-3 px-4">{u._count?.domains || 0}</td>
                  <td className="py-3 px-4 text-thistle-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Protection Modal */}
      {actionTargetDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={() => setActionTargetDomain(null)} />
          <div className="relative w-full max-w-md bg-white border border-gold-500/45 rounded-3xl p-6 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 border border-gold-400/50 flex items-center justify-center flex-shrink-0">
                <Icons.Warning />
              </div>
              <div>
                <h3 className="text-base font-bold text-royal-950">Confirm High-Impact Action</h3>
                <p className="text-xs text-thistle-500">Action Protection is armed for cross-tenant modifications.</p>
              </div>
            </div>

            <p className="text-xs text-royal-950/80 bg-thistle-50 p-3 rounded-xl border border-gold-500/35">
              You are about to <strong className="text-royal-950 uppercase font-black">{actionTargetDomain.type}</strong> all sending from domain <span className="font-mono font-bold text-royal-700">{actionTargetDomain.name}</span>.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-thistle-500 uppercase tracking-wider mb-1">
                Re-enter Operator Passphrase
              </label>
              <input
                type="password"
                value={actionConfirmPassphrase}
                onChange={(e) => setActionConfirmPassphrase(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-mono focus:outline-none focus:border-gold-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gold-500/35">
              <button
                type="button"
                onClick={() => setActionTargetDomain(null)}
                className="px-3.5 py-1.5 text-xs text-thistle-500 font-bold hover:text-royal-950"
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