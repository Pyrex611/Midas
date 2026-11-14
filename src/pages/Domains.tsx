import React, { useEffect, useState } from 'react';
import { domainAPI, getErrorMessage } from '../services/api';
import { DomainsHeader } from '../components/domains/DomainsHeader';
import { BimiGuideBanner } from '../components/domains/BimiGuideBanner';
import { DomainCard, DomainCardData } from '../components/domains/DomainCard';
import { ConnectDomainDrawer } from '../components/domains/drawers/ConnectDomainDrawer';
import { BimiAvatarDrawer } from '../components/domains/drawers/BimiAvatarDrawer';
import { Icons } from '../lib/icons';

export const Domains: React.FC = () => {
  const [domains, setDomains] = useState<DomainCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

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

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <DomainsHeader
        domainsCount={domains.length}
        onOpenConnectDrawer={() => setIsConnectDrawerOpen(true)}
      />

      <BimiGuideBanner />

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
      ) : (
        <div className="space-y-6">
          {domains.map((domain) => (
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