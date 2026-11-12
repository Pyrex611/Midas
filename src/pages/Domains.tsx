import React, { useEffect, useState } from 'react';
import { domainAPI, getErrorMessage } from '../services/api';
import { DomainsHeader } from '../components/domains/DomainsHeader';
import { BimiGuideBanner } from '../components/domains/BimiGuideBanner';
import { DomainCard, DomainCardData } from '../components/domains/DomainCard';
import { ConnectDomainDrawer } from '../components/domains/drawers/ConnectDomainDrawer';
import { BimiAvatarDrawer } from '../components/domains/drawers/BimiAvatarDrawer';

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
          <button onClick={() => setErrorBanner(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-zinc-400 text-xs font-medium">Loading domains and sender quotas...</div>
      ) : domains.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-zinc-900">No sending domains connected</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Connect an authenticated domain to enable autonomous sending, mailbox rotation, and custom inbox avatars.
          </p>
          <button
            onClick={() => setIsConnectDrawerOpen(true)}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
          >
            Connect First Domain
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