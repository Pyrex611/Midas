import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { userAPI, domainAPI } from '../../services/api';
import { CommandPalette } from '../CommandPalette';

interface AppShellProps {
  children: React.ReactNode;
}

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
    { label: 'Overview', path: '/', icon: '🏠' },
    { label: 'Campaigns', path: '/campaigns', icon: '📊' },
    { label: 'Unified Inbox', path: '/inbox', icon: '📥' },
    { label: 'All Leads', path: '/leads', icon: '📋' },
    { label: 'Sending Domains', path: '/domains', icon: '🌐' },
    ...(isAdmin ? [{ label: 'Admin Command', path: '/admin', icon: '🛡️' }] : []),
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-zinc-200 bg-white transition-all duration-200 z-30 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 px-6 border-b border-zinc-100 flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <span className="text-xl font-black bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent">
                MIDAS
              </span>
              <span className="text-[10px] font-bold uppercase bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                PROD
              </span>
            </div>
          ) : (
            <span className="text-xl font-black text-amber-600 mx-auto">M</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-base">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Deliverability Pulse Radar Widget */}
        {!collapsed && (
          <div className="m-3 p-3.5 bg-zinc-900 text-white rounded-2xl shadow-lg border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Deliverability Health
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs font-semibold text-zinc-200">
              {activeDomainsCount} Domains Operating
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Circuit breakers armed</p>
          </div>
        )}

        {/* Profile Link */}
        <div className="p-3 border-t border-zinc-100">
          <Link
            to="/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            <span className="text-base">👤</span>
            {!collapsed && <span className="text-sm font-medium">Settings & Profile</span>}
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
              <span>Quick Actions</span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-zinc-600 border border-zinc-200">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-500 hidden sm:inline-block">
              Golden Email Engine
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
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