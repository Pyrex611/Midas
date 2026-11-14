import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../lib/icons';

interface CommandAction {
  label: string;
  path: string;
  category: string;
  icon: React.ReactNode;
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
        if (isOpen) onClose();
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
    { label: 'Overview & Lead Ingestion', path: '/', category: 'Navigation', icon: <Icons.Home />, keywords: 'home dashboard upload blocklist' },
    { label: 'Campaigns & Sequences', path: '/campaigns', category: 'Navigation', icon: <Icons.Campaigns />, keywords: 'sequences outreach emails cold sales' },
    { label: 'Unified Inbox', path: '/inbox', category: 'Navigation', icon: <Icons.Inbox />, keywords: 'replies unread triage messages conversations' },
    { label: 'Leads Command Hub', path: '/leads', category: 'Navigation', icon: <Icons.Leads />, keywords: 'contacts prospects list data imports' },
    { label: 'Sending Domains & Mailboxes', path: '/domains', category: 'Infrastructure', icon: <Icons.Domains />, keywords: 'domains mailboxes mailgun senders dmarc bimi' },
    { label: 'Sender Avatars & BIMI Setup', path: '/domains', category: 'Infrastructure', icon: <Icons.Image />, keywords: 'avatar logo bimi icon photo picture brand image' },
    { label: 'Town Crier Newsletter Hub', path: '/town-crier', category: 'Marketing', icon: <Icons.TownCrier />, keywords: 'broadcasts newsletter subscribers gongs embed widget' },
    { label: 'Developer Docs & API Reference', path: '/docs', category: 'Documentation', icon: <Icons.Book />, keywords: 'docs api guide sdk developer documentation manual integration help cli' },
    { label: 'Workspace API Keys', path: '/profile?tab=apiKeys', category: 'Developer', icon: <Icons.Key />, keywords: 'api keys secret token midas_live developer credentials' },
    { label: 'Outbound CRM Webhooks', path: '/profile?tab=webhooks', category: 'Developer', icon: <Icons.Link />, keywords: 'webhooks crm hubspot salesforce events integration' },
    { label: 'Account, AI Studio & Throttling', path: '/profile?tab=settings', category: 'Account', icon: <Icons.Settings />, keywords: 'settings limits quotas profile user password ai models' },
    ...(isAdmin ? [{ label: 'Platform Operator Command', path: '/admin', category: 'Administration', icon: <Icons.Admin />, keywords: 'admin operator circuit breaker clearance' }] : []),
  ];

  const q = query.toLowerCase().trim();
  const filtered = actions.filter((a) => {
    if (!q) return true;
    return a.label.toLowerCase().includes(q) || (a.keywords || '').toLowerCase().includes(q);
  });

  const handleSelect = (path: string) => {
    navigate(path);
    setQuery('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
      <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative mx-auto max-w-xl bg-white rounded-2xl shadow-2xl border border-thistle-300 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 border-b border-thistle-200 bg-thistle-50/70">
          <span className="text-thistle-500 mr-3">
            <Icons.Search />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to workspace view, Developer Docs, or settings..."
            className="w-full py-4 text-sm text-royal-950 placeholder-thistle-500 bg-transparent focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-royal-700 bg-white rounded border border-thistle-300">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="p-6 text-xs text-center text-thistle-500">No matching commands or routes found.</p>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(item.path)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-thistle-100/80 border border-transparent hover:border-gold-400/50 text-left text-sm font-medium text-royal-950 hover:text-royal-700 transition-all group"
              >
                <span className="flex items-center gap-3">
                  <span className="text-thistle-500 group-hover:text-gold-600 transition-colors">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-royal-700 bg-thistle-100 group-hover:bg-gold-200/70 px-2 py-0.5 rounded border border-thistle-200">
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