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
          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
          autoFocus
        />

        {leads.length === 0 ? (
          <p className="py-12 text-center text-xs text-zinc-400">No leads match this category or search query.</p>
        ) : (
          <div className="space-y-2 max-h-[65vh] overflow-y-auto">
            {leads.map((l: any) => (
              <div
                key={l.id}
                onClick={() => onLeadClick(l)}
                className="p-3 bg-zinc-50 hover:bg-blue-50/60 border border-zinc-200 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-zinc-900">{l.name}</p>
                  <p className="text-[11px] text-zinc-400 font-mono">{l.email}</p>
                  <p className="text-[10px] text-zinc-500">
                    {l.company || 'No Company'} · {l.position || 'No Title'}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700">
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