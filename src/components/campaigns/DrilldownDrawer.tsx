import React from 'react';
import { Sheet } from '../common/Sheet';

interface DrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category: string | null;
  leads: any[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLeadClick: (lead: any) => void;
}

export const DrilldownDrawer: React.FC<DrilldownDrawerProps> = ({
  isOpen,
  onClose,
  category,
  leads,
  searchQuery,
  onSearchChange,
  onLeadClick,
}) => {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Prospects: ${category} (${leads.length})`}
      description="Inspect and search leads in this specific funnel conversion segment."
      width="xl"
    >
      <div className="space-y-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search leads by name, email, or company..."
          className="w-full px-3 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs text-royal-950 focus:outline-none focus:border-gold-500"
          autoFocus
        />

        {leads.length === 0 ? (
          <p className="py-12 text-center text-xs text-thistle-500">No leads match this category or search query.</p>
        ) : (
          <div className="space-y-2 max-h-[65vh] overflow-y-auto">
            {leads.map((l: any) => (
              <div
                key={l.id}
                onClick={() => onLeadClick(l)}
                className="p-3 bg-thistle-50/70 hover:bg-thistle-100 border border-gold-500/35 glow-gold-hover rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-royal-950">{l.name}</p>
                  <p className="text-[11px] text-thistle-500 font-mono">{l.email}</p>
                  <p className="text-[10px] text-royal-800/70">
                    {l.company || 'No Company'} · {l.position || 'No Title'}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-gold-500/35 text-royal-800">
                  {l.outreachStatus || l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
};