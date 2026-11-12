import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandAction {
  label: string;
  path: string;
  category: string;
  keywords?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, isAdmin = false }) => {
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

  const actions: CommandAction[] = [
    { label: '📊 View Campaigns', path: '/campaigns', category: 'Navigation', keywords: 'sequences outreach emails cold sales' },
    { label: '📥 Open Unified Inbox', path: '/inbox', category: 'Navigation', keywords: 'replies unread triage messages conversations' },
    { label: '📋 View All Leads', path: '/leads', category: 'Navigation', keywords: 'contacts prospects list data imports' },
    { label: '🌐 Manage Sending Domains', path: '/domains', category: 'Infrastructure', keywords: 'domains mailboxes mailgun senders dmarc bimi' },
    { label: '🖼️ Sender Avatar & BIMI Logo (Inbox Avatars)', path: '/domains', category: 'Infrastructure', keywords: 'avatar logo bimi icon photo picture brand image' },
    { label: '📣 Town Crier Newsletter Hub', path: '/town-crier', category: 'Marketing', keywords: 'broadcasts newsletter subscribers gongs embed widget' },
    { label: '📖 Developer Docs & API Guide', path: '/docs', category: 'Documentation', keywords: 'docs api guide sdk developer documentation manual integration help cli' },
    { label: '🔑 Developer API Keys (Workspace)', path: '/profile?tab=apiKeys', category: 'Developer', keywords: 'api keys secret token midas_live developer credentials' },
    { label: '⚡ Outbound Webhooks (CRM Sync)', path: '/profile?tab=webhooks', category: 'Developer', keywords: 'webhooks crm hubspot salesforce events integration' },
    { label: '👤 User Profile & Delivery Throttling', path: '/profile?tab=settings', category: 'Account', keywords: 'settings limits quotas profile user password' },
    ...(isAdmin ? [{ label: '🛡️ Platform Admin Dashboard', path: '/admin', category: 'Administration', keywords: 'admin operator circuit breaker clearance' }] : []),
  ];

  const q = query.toLowerCase().trim();
  const filtered = actions.filter((a) => {
    if (!q) return true;
    return a.label.toLowerCase().includes(q) || (a.keywords || '').toLowerCase().includes(q);
  });

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
      <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative mx-auto max-w-xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 border-b border-zinc-100">
          <svg className="w-5 h-5 text-zinc-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, docs, or destinations (e.g. 'docs', 'api keys', 'gongs')..."
            className="w-full py-4 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-zinc-400 bg-zinc-100 rounded border border-zinc-200">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-center text-zinc-400">No matching commands or destinations found.</p>
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