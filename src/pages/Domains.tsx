import React, { useEffect, useState, useMemo } from 'react';
import { domainAPI, senderAPI, getErrorMessage } from '../services/api';
import { DomainsHeader } from '../components/domains/DomainsHeader';
import { BimiGuideBanner } from '../components/domains/BimiGuideBanner';
import { SandboxCard } from '../components/domains/SandboxCard';
import { DomainCard, DomainCardData } from '../components/domains/DomainCard';
import { ConnectDomainDrawer } from '../components/domains/drawers/ConnectDomainDrawer';
import { BimiAvatarDrawer } from '../components/domains/drawers/BimiAvatarDrawer';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

export const Domains: React.FC = () => {
  const { toast } = useToast();
  const [domains, setDomains] = useState<DomainCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Multi-Domain & Mailbox Explorer Controls
  const [viewMode, setViewMode] = useState<'domains' | 'mailboxes'>('domains');
  const [domainFilterId, setDomainFilterId] = useState<string>('all');
  const [espFilter, setEspFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingSenderId, setTogglingSenderId] = useState<string | null>(null);

  const [isConnectDrawerOpen, setIsConnectDrawerOpen] = useState(false);
  const [bimiDrawerDomain, setBimiDrawerDomain] = useState<DomainCardData | null>(null);

  const fetchDomains = async () => {
    try {
      setErrorBanner(null);
      const res = await domainAPI.getAll();
      setDomains(res.data || []);
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Failed to load domains'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      if (domainFilterId !== 'all' && d.id !== domainFilterId) return false;
      if (espFilter !== 'all' && (d.espProvider || 'mailgun') !== espFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDomain = d.domainName.toLowerCase().includes(q);
        const matchesSender = (d.senders || []).some((s: any) =>
          `${s.localPart}@${d.domainName}`.toLowerCase().includes(q)
        );
        return matchesDomain || matchesSender;
      }
      return true;
    });
  }, [domains, domainFilterId, espFilter, searchQuery]);

  const flattenedSenders = useMemo(() => {
    const list: Array<any & { domainName: string; domainStatus: string; espProvider: string }> = [];
    for (const d of filteredDomains) {
      for (const s of d.senders || []) {
        const fullAddress = `${s.localPart}@${d.domainName}`.toLowerCase();
        if (searchQuery.trim() && !fullAddress.includes(searchQuery.toLowerCase())) {
          continue;
        }
        list.push({
          ...s,
          domainName: d.domainName,
          domainStatus: d.status,
          espProvider: d.espProvider || 'mailgun',
        });
      }
    }
    return list;
  }, [filteredDomains, searchQuery]);

  const handleToggleSenderStatus = async (sender: any) => {
    const nextStatus = sender.status === 'active' ? 'paused' : 'active';
    setTogglingSenderId(sender.id);
    try {
      await senderAPI.update(sender.id, { status: nextStatus });
      toast.success(
        `${sender.localPart}@${sender.domainName} is now ${nextStatus.toUpperCase()}`,
        'Mailbox Updated'
      );
      await fetchDomains();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update mailbox status'), 'Error');
    } finally {
      setTogglingSenderId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <DomainsHeader
        domainsCount={domains.length}
        onOpenConnectDrawer={() => setIsConnectDrawerOpen(true)}
      />

      <SandboxCard />
      <BimiGuideBanner />

      {/* Multi-Domain & Mailbox Explorer Bar */}
      {domains.length > 0 && (
        <div className="p-4 card-midas rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
          <div className="flex bg-thistle-100 p-1 rounded-xl border border-gold-500/35 self-start">
            <button
              type="button"
              onClick={() => setViewMode('domains')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'domains'
                  ? 'bg-royal-700 text-white shadow-xs'
                  : 'text-royal-800 hover:bg-white/60'
              }`}
            >
              Domains View ({filteredDomains.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mailboxes')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'mailboxes'
                  ? 'bg-royal-700 text-white shadow-xs'
                  : 'text-royal-800 hover:bg-white/60'
              }`}
            >
              All Mailboxes ({flattenedSenders.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end">
            <select
              value={domainFilterId}
              onChange={(e) => setDomainFilterId(e.target.value)}
              className="px-3 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-xl font-semibold text-royal-950 focus:outline-none focus:border-gold-500"
            >
              <option value="all">Filter: All Domains ({domains.length})</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.domainName} ({d.senders?.length || 0} senders)
                </option>
              ))}
            </select>

            <select
              value={espFilter}
              onChange={(e) => setEspFilter(e.target.value)}
              className="px-3 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-xl font-semibold text-royal-950 focus:outline-none focus:border-gold-500"
            >
              <option value="all">ESP: All Providers</option>
              <option value="mailgun">Mailgun</option>
              <option value="resend">Resend (Newsletter)</option>
              <option value="smtp">Custom SMTP</option>
            </select>

            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <span className="absolute left-3 top-2 text-thistle-500">
                <Icons.Search className="text-xs" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search domain or mailbox..."
                className="w-full pl-8 pr-3 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-xl text-xs text-royal-950 focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>
        </div>
      )}

      {errorBanner && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-rose-700 flex justify-between items-center shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Error:</span>
            <span className="text-sm font-medium">{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">
            <Icons.Close />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-thistle-500 text-xs font-medium">Loading domains and sender quotas...</div>
      ) : domains.length === 0 ? (
        <div className="card-midas rounded-2xl p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-thistle-100 text-royal-700 border border-gold-500/35 mx-auto flex items-center justify-center">
            <Icons.Domains className="text-2xl text-gold-600" />
          </div>
          <h3 className="text-base font-bold text-royal-950">No sending domains connected</h3>
          <p className="text-xs text-thistle-500 max-w-sm mx-auto">
            Connect an authenticated domain to enable autonomous sending, mailbox rotation, and custom inbox avatars.
          </p>
          <button
            onClick={() => setIsConnectDrawerOpen(true)}
            className="mt-2 px-4 py-2 btn-royal rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Icons.Plus className="text-gold-300" />
            <span>Connect First Domain</span>
          </button>
        </div>
      ) : viewMode === 'mailboxes' ? (
        <div className="bg-white rounded-2xl border border-gold-500/40 overflow-hidden shadow-xs">
          {flattenedSenders.length === 0 ? (
            <div className="py-16 text-center text-xs text-thistle-500">
              No mailboxes match the selected Domain/ESP filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gold-500/25 text-left text-xs">
                <thead className="bg-thistle-100/75 text-royal-800 font-bold uppercase tracking-wider border-b border-gold-500/35 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Mailbox Address</th>
                    <th className="py-3 px-4">Domain &amp; ESP</th>
                    <th className="py-3 px-4">Display Name</th>
                    <th className="py-3 px-4">Daily Usage / Cap</th>
                    <th className="py-3 px-4">Warmup</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-500/20 font-medium text-royal-950">
                  {flattenedSenders.map((s) => (
                    <tr key={s.id} className="hover:bg-thistle-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-royal-950">
                        {s.localPart}@{s.domainName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-thistle-100 text-royal-800 font-mono text-[10px] uppercase border border-gold-500/30">
                          {s.espProvider}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-thistle-500">{s.displayName || '—'}</td>
                      <td className="py-3 px-4 font-mono">
                        <strong>{s.sentCountToday}</strong> / {s.dailyLimit}
                      </td>
                      <td className="py-3 px-4">Day {s.warmupDay}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-gold-400/50'
                        }`}>
                          {s.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleSenderStatus(s)}
                          disabled={togglingSenderId === s.id}
                          className="text-xs font-bold text-royal-700 hover:underline"
                        >
                          {s.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredDomains.map((domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              onOpenBimiDrawer={(d) => setBimiDrawerDomain(d)}
              onRefresh={fetchDomains}
            />
          ))}
        </div>
      )}

      <ConnectDomainDrawer
        isOpen={isConnectDrawerOpen}
        onClose={() => setIsConnectDrawerOpen(false)}
        onSuccess={fetchDomains}
        onErrorBanner={setErrorBanner}
      />

      <BimiAvatarDrawer
        domain={bimiDrawerDomain}
        onClose={() => setBimiDrawerDomain(null)}
        onSuccess={fetchDomains}
      />
    </div>
  );
};