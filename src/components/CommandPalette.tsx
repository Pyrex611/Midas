import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { label: '📊 View Campaigns', path: '/campaigns', category: 'Navigation' },
    { label: '📥 Open Unified Inbox', path: '/inbox', category: 'Navigation' },
    { label: '📋 View All Leads', path: '/leads', category: 'Navigation' },
    { label: '🌐 Manage Sending Domains', path: '/domains', category: 'Infrastructure' },
    { label: '👤 User Profile & Settings', path: '/profile', category: 'Account' },
    { label: '🛡️ Platform Admin Dashboard', path: '/admin', category: 'Administration' },
  ];

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
      <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative mx-auto max-w-xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-zinc-100">
          <svg className="w-5 h-5 text-zinc-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, campaigns, or routes (e.g. Inbox)..."
            className="w-full py-4 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-zinc-400 bg-zinc-100 rounded border border-zinc-200">
            ESC
          </kbd>
        </div>

        {/* Command Action Items */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-center text-zinc-400">No matching commands found.</p>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(item.path)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 text-left text-sm font-medium text-zinc-700 hover:text-blue-600 transition-colors group"
              >
                <span>{item.label}</span>
                <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-100 group-hover:bg-blue-50 group-hover:text-blue-600 px-2 py-0.5 rounded">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};