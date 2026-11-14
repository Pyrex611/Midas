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
    return <div className="py-24 text-center text-xs text-thistle-500">Loading Gong channels...</div>;
  }

  if (gongs.length === 0) {
    return (
      <div className="card-midas rounded-2xl p-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-thistle-100 text-royal-700 border border-gold-500/40 mx-auto flex items-center justify-center">
          <Icons.TownCrier className="text-xl text-gold-600" />
        </div>
        <h3 className="text-base font-bold text-royal-950">No Gong Channels Created Yet</h3>
        <p className="text-xs text-thistle-500 max-w-sm mx-auto">
          Create publication channels (e.g. "Weekly Alpha", "Deal Alerts") with automated welcome lead magnets and dedicated isolated inboxes.
        </p>
        <button
          onClick={onOpenCreateGong}
          className="px-4 py-2 btn-royal rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Icons.Plus className="text-gold-300" />
          <span>Create First Gong Channel</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-gold-500/30">
        <span className="text-xs font-bold text-thistle-500 uppercase tracking-wider">Active Channels ({gongs.length})</span>
        <button
          onClick={onOpenCreateGong}
          className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Icons.Plus className="text-gold-300" />
          <span>New Gong Channel</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gongs.map((gong) => (
          <div key={gong.id} className="p-5 card-midas rounded-2xl space-y-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-royal-950">{gong.name}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-thistle-100 text-royal-800 border border-gold-500/30">
                    /{gong.slug}
                  </span>
                </div>
                <p className="text-xs text-thistle-500 mt-0.5">{gong.description || 'No description provided.'}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenQuickstart(gong)}
                  className="px-2.5 py-1 bg-thistle-100 hover:bg-thistle-200 text-royal-800 border border-gold-500/40 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1"
                >
                  <Icons.Bolt className="text-gold-600 text-[11px]" />
                  <span>Deploy Snippets</span>
                </button>
                <button
                  onClick={() => onEditGong(gong)}
                  className="text-xs font-bold text-royal-700 hover:text-royal-950"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gold-500/30 text-[11px] text-royal-950">
              <div className="p-2 bg-thistle-50/70 border border-gold-500/25 rounded-lg">
                <span className="block text-[9px] uppercase font-bold text-thistle-500">Cadence</span>
                <span className="font-bold text-royal-950 uppercase">{gong.cadence || 'weekly'}</span>
              </div>
              <div className="p-2 bg-thistle-50/70 border border-gold-500/25 rounded-lg">
                <span className="block text-[9px] uppercase font-bold text-thistle-500">Welcome Email</span>
                <span className={`font-bold ${gong.welcomeEmailEnabled ? 'text-emerald-700' : 'text-thistle-500'}`}>
                  {gong.welcomeEmailEnabled ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div className="p-2 bg-thistle-50/70 border border-gold-500/25 rounded-lg">
                <span className="block text-[9px] uppercase font-bold text-thistle-500">Sender</span>
                <span className="font-bold text-royal-800 font-mono truncate block">
                  {gong.dedicatedSender
                    ? `${gong.dedicatedSender.localPart}@${gong.dedicatedSender.domain?.domainName}`
                    : gong.embedTheme || 'Pool'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gold-500/25 text-[11px] text-thistle-500 font-mono">
              <span>Channel ID: <code className="bg-thistle-50 px-1 py-0.5 rounded border border-gold-500/30 text-royal-800">{gong.id}</code></span>
              <span className="text-royal-950 font-bold">{gong._count?.recipients || 0} Subscribers</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};