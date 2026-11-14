import React from 'react';
import { Icons } from '../../lib/icons';

interface DomainsHeaderProps {
  domainsCount: number;
  onOpenConnectDrawer: () => void;
}

export const DomainsHeader: React.FC<DomainsHeaderProps> = ({
  domainsCount,
  onOpenConnectDrawer,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gold-500/40">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-royal-950 tracking-tight">Sending Domains</h1>
          <button
            onClick={onOpenConnectDrawer}
            className="px-3.5 py-1.5 btn-royal text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Icons.Plus className="text-gold-300" />
            <span>Connect New Domain</span>
          </button>
        </div>
        <p className="text-xs text-thistle-500 mt-1">
          Manage authenticated sending domains, Mailgun keys, sender avatars (BIMI), and mailbox quotas.
        </p>
      </div>

      <div className="text-xs font-bold bg-white text-royal-800 px-3 py-1.5 rounded-xl border border-gold-500/40 shadow-xs">
        {domainsCount} Domain{domainsCount === 1 ? '' : 's'} Active
      </div>
    </div>
  );
};