import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { userAPI, domainAPI } from '../../services/api';
import { CommandPalette } from '../CommandPalette';

interface AppShellProps {
  children: React.ReactNode;
}

// Line Art SVG Icons
const Icons = {
  Home: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  Campaigns: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  Inbox: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m4.179 2.51l4.66 2.51m-9.32 0l-4.66-2.51M21.75 6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75z" />
    </svg>
  ),
  Leads: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  Domains: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
    </svg>
  ),
  Admin: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  Profile: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.964 0a9 9 0 10-11.963 0m11.964 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [activeDomainsCount, setActiveDomainsCount] = useState(0);

  useEffect(() => {
    userAPI
      .getProfile()
      .then((res) => setIsAdmin(!!res.data?.user?.isAdmin))
      .catch(() => setIsAdmin(false));

    domainAPI
      .getAll()
      .then((res) => {
        const active = (res.data || []).filter((d: any) => d.status === 'active').length;
        setActiveDomainsCount(active);
      })
      .catch(() => {});
  }, []);

  // Global keydown for Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { label: 'Overview', path: '/', icon: <Icons.Home /> },
    { label: 'Campaigns', path: '/campaigns', icon: <Icons.Campaigns /> },
    { label: 'Unified Inbox', path: '/inbox', icon: <Icons.Inbox /> },
    { label: 'All Leads', path: '/leads', icon: <Icons.Leads /> },
    { label: 'Sending Domains', path: '/domains', icon: <Icons.Domains /> },
    ...(isAdmin ? [{ label: 'Admin Command', path: '/admin', icon: <Icons.Admin /> }] : []),
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* 
        DESKTOP PERSISTENT SIDEBAR:
        - `h-screen sticky top-0`: Strictly anchored to viewport height, never pushes off-screen.
        - `flex-col justify-between`: Header & Nav at top, Deliverability & Profile locked at bottom.
      */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-zinc-200 bg-white transition-all duration-200 z-30 select-none ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex-shrink-0 px-6 border-b border-zinc-100 flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <span className="text-xl font-black bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent tracking-wider">
                MIDAS
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-md">
                PROD
              </span>
            </div>
          ) : (
            <span className="text-xl font-black text-amber-600 mx-auto">M</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Scrollable Navigation List (only nav scrolls if viewport is short) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={isActive ? 'text-blue-600' : 'text-zinc-400'}>{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* 
          LOCKED FOOTER (Never goes below screen fold):
          Contains Deliverability Pulse + Settings & Profile
        */}
        <div className="flex-shrink-0 p-3 border-t border-zinc-100 bg-white space-y-2">
          {/* Deliverability Radar Widget */}
          {!collapsed && (
            <div className="p-3 bg-zinc-900 text-white rounded-xl shadow-xs border border-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Deliverability Pulse
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs font-bold text-zinc-200">
                {activeDomainsCount} Domains Active
              </p>
              <p className="text-[10px] text-zinc-400">Circuit breakers armed</p>
            </div>
          )}

          {/* Profile & Settings (Permanently Visible) */}
          <Link
            to="/profile"
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-700 transition-colors"
            title={collapsed ? 'Settings & Profile' : undefined}
          >
            <span className="text-zinc-400"><Icons.Profile /></span>
            {!collapsed && <span className="text-xs font-bold text-zinc-800">Settings & Profile</span>}
          </Link>
        </div>
      </aside>

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200/80 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs text-zinc-500 transition-colors"
            >
              <span className="font-medium">Quick Actions</span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-zinc-600 border border-zinc-200">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-500 hidden sm:inline-block">
              Autonomous Outbound Infrastructure
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" title="System Operational" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
};