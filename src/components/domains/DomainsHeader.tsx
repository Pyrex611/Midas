import React from 'react';

interface DomainsHeaderProps {
  domainsCount: number;
  onOpenConnectDrawer: () => void;
}

export const DomainsHeader: React.FC<DomainsHeaderProps> = ({
  domainsCount,
  onOpenConnectDrawer,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Sending Domains</h1>
          <button
            onClick={onOpenConnectDrawer}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>+ Connect New Domain</span>
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Manage authenticated sending domains, Mailgun keys, sender avatars (BIMI), and mailbox quotas.
        </p>
      </div>

      <div className="text-xs font-bold bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-xl border border-zinc-200">
        {domainsCount} Domain{domainsCount === 1 ? '' : 's'} Active
      </div>
    </div>
  );
};