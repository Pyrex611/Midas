import React from 'react';
import { Icons } from '../../../lib/icons';

interface TownCrierGongsTabProps {
  gongs: any[];
  loading: boolean;
  onOpenCreateGong: () => void;
  onEditGong: (gong: any) => void;
  onOpenQuickstart: (gong: any) => void;
}

export const TownCrierGongsTab: React.FC<TownCrierGongsTabProps> = ({
  gongs,
  loading,
  onOpenCreateGong,
  onEditGong,
  onOpenQuickstart,
}) => {
  if (loading) {
    return <div className="py-24 text-center text-xs text-zinc-400">Loading Gong channels...</div>;
  }

  if (gongs.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center">
          <Icons.TownCrier className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-zinc-900">No Gong Channels Created Yet</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Create publication channels (e.g. "Weekly Alpha", "Deal Alerts") with automated welcome lead magnets and dedicated isolated inboxes.
        </p>
        <button
          onClick={onOpenCreateGong}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
        >
          + Create First Gong Channel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Active Channels ({gongs.length})</span>
        <button
          onClick={onOpenCreateGong}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
        >
          + New Gong Channel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gongs.map((gong) => (
          <div key={gong.id} className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900">{gong.name}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-100 text-zinc-700">
                    /{gong.slug}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{gong.description || 'No description provided.'}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenQuickstart(gong)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold shadow-2xs transition-colors"
                >
                  ⚡ Deploy Snippets
                </button>
                <button
                  onClick={() => onEditGong(gong)}
                  className="text-xs font-bold text-zinc-600 hover:text-zinc-900"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-[11px] text-zinc-600">
              <div className="p-2 bg-zinc-50 rounded-lg">
                <span className="block text-[9px] uppercase font-bold text-zinc-400">Cadence</span>
                <span className="font-bold text-zinc-800 uppercase">{gong.cadence || 'weekly'}</span>
              </div>
              <div className="p-2 bg-zinc-50 rounded-lg">
                <span className="block text-[9px] uppercase font-bold text-zinc-400">Welcome Autoresponder</span>
                <span className={`font-bold ${gong.welcomeEmailEnabled ? 'text-emerald-700' : 'text-zinc-500'}`}>
                  {gong.welcomeEmailEnabled ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div className="p-2 bg-zinc-50 rounded-lg">
                <span className="block text-[9px] uppercase font-bold text-zinc-400">Theme</span>
                <span className="font-bold text-zinc-800 uppercase">{gong.embedTheme || 'card'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400 font-mono">
              <span>Channel ID: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-700">{gong.id}</code></span>
              <span className="text-zinc-600 font-bold">{gong._count?.recipients || 0} Subscribers</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};