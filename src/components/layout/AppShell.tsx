import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { userAPI, domainAPI, aiAPI } from '../../services/api';
import { CommandPalette } from '../CommandPalette';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [hasOperatorClearance, setHasOperatorClearance] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('midas_sidebar_collapsed') === 'true');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [activeDomainsCount, setActiveDomainsCount] = useState(0);

  // Global AI Switcher Popover State
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [activeAiProvider, setActiveAiProvider] = useState<string>('aigateway');
  const [activeAiModel, setActiveAiModel] = useState<string>('openai/gpt-4o-mini');
  const [confirmedIntegrations, setConfirmedIntegrations] = useState<any[]>([]);
  const aiMenuRef = useRef<HTMLDivElement | null>(null);

  const fetchAIState = () => {
    aiAPI.getIntegrations()
      .then(res => {
        setActiveAiProvider(res.data?.activeProvider || 'aigateway');
        setActiveAiModel(res.data?.activeModel || 'openai/gpt-4o-mini');
        setConfirmedIntegrations(res.data?.integrations || []);
      })
      .catch(() => {});
  };

  const checkClearanceState = () => {
    const token = sessionStorage.getItem('midas_operator_token');
    const expiresAt = Number(sessionStorage.getItem('midas_operator_expires_at') || 0);
    setHasOperatorClearance(Boolean(token && expiresAt > Date.now()));
  };

  useEffect(() => {
    userAPI
      .getProfile()
      .then((res) => setIsAdmin(!!res.data?.user?.isAdmin))
      .catch(() => setIsAdmin(false));

    checkClearanceState();
    fetchAIState();

    domainAPI
      .getAll()
      .then((res) => {
        const active = (res.data || []).filter((d: any) => d.status === 'active').length;
        setActiveDomainsCount(active);
      })
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const handleSyncEvents = () => {
      checkClearanceState();
      fetchAIState();
    };

    window.addEventListener('operator_auth_changed', handleSyncEvents);
    window.addEventListener('ai_config_changed', handleSyncEvents);
    window.addEventListener('storage', handleSyncEvents);

    return () => {
      window.removeEventListener('operator_auth_changed', handleSyncEvents);
      window.removeEventListener('ai_config_changed', handleSyncEvents);
      window.removeEventListener('storage', handleSyncEvents);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
    };
    if (aiMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [aiMenuOpen]);

  const handleQuickSwitchAI = async (provider: string, model: string) => {
    try {
      await aiAPI.switchActive(provider, model);
      setActiveAiProvider(provider);
      setActiveAiModel(model);
      setAiMenuOpen(false);
      window.dispatchEvent(new Event('ai_config_changed'));
      toast.success(`Active AI switched to ${model}`, 'Model Updated');
    } catch {
      toast.error('Failed to switch AI model', 'Error');
    }
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('midas_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

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
    { label: 'Town Crier', path: '/town-crier', icon: <Icons.TownCrier /> },
    { label: 'Unified Inbox', path: '/inbox', icon: <Icons.Inbox /> },
    { label: 'All Leads', path: '/leads', icon: <Icons.Leads /> },
    { label: 'Sending Domains', path: '/domains', icon: <Icons.Domains /> },
    ...(isAdmin || hasOperatorClearance
      ? [{ label: 'Admin Command', path: '/admin', icon: <Icons.Admin /> }]
      : []),
  ];

  const getBreadcrumbs = () => {
    const p = location.pathname;
    if (p === '/') return 'Overview';
    if (p.startsWith('/campaigns/')) return 'Campaigns / Sequence Studio';
    if (p === '/campaigns') return 'Campaigns';
    if (p === '/town-crier') return 'Town Crier Newsletter';
    if (p === '/inbox') return 'Unified Inbox';
    if (p === '/leads') return 'Leads Hub';
    if (p === '/domains') return 'Sending Domains';
    if (p === '/profile') return 'Account & Settings';
    if (p === '/admin') return 'Operator Command';
    return 'Workspace';
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Desktop Persistent Sticky Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-zinc-200 bg-white transition-all duration-200 z-30 select-none ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
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
            onClick={toggleCollapsed}
            className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

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

        {/* Anchored Footer */}
        <div className="flex-shrink-0 p-3 border-t border-zinc-100 bg-white space-y-2">
          {!collapsed && (
            <div className="p-3 bg-zinc-900 text-white rounded-xl shadow-xs border border-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Deliverability Pulse
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs font-bold text-zinc-200">
                {activeDomainsCount} Domains Operating
              </p>
              <p className="text-[10px] text-zinc-400">Circuit breakers armed</p>
            </div>
          )}

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

      {/* Mobile Responsive Slide-Out Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative w-72 max-w-[80vw] h-[100dvh] bg-white shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="h-16 px-6 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-xl font-black bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent tracking-wider">
                  MIDAS
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"
                >
                  <Icons.Close />
                </button>
              </div>

              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <span className={isActive ? 'text-blue-600' : 'text-zinc-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-zinc-100 space-y-3">
              <div className="p-3 bg-zinc-900 text-white rounded-xl shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Deliverability Pulse</p>
                <p className="text-xs font-bold text-zinc-200 mt-0.5">{activeDomainsCount} Domains Active</p>
              </div>

              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-2 rounded-xl text-zinc-800 font-bold text-xs hover:bg-zinc-100"
              >
                <span className="text-zinc-400"><Icons.Profile /></span>
                <span>Settings & Profile</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Viewport & Top Header Bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-zinc-500 hover:text-zinc-800 rounded-lg md:hidden"
              title="Open Navigation Menu"
            >
              <Icons.Menu />
            </button>

            <span className="text-xs font-black uppercase tracking-wider text-zinc-400 hidden sm:inline-block">
              {getBreadcrumbs()}
            </span>

            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs text-zinc-500 transition-colors ml-1"
            >
              <span className="font-medium">Quick Actions</span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-zinc-600 border border-zinc-200 shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* AI Quick Switcher Dropdown */}
            <div className="relative" ref={aiMenuRef}>
              <button
                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/60 text-xs font-bold text-blue-700 transition-all shadow-2xs group"
                title="Active AI Provider & Model (Click to Switch)"
              >
                <span className="text-blue-600 group-hover:rotate-12 transition-transform">
                  <Icons.Sparkles />
                </span>
                <span className="max-w-[140px] sm:max-w-[200px] truncate">
                  {activeAiModel.split('/').pop()}
                </span>
                <span className="text-[10px] opacity-60">▾</span>
              </button>

              {aiMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2">
                  <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-zinc-900">Active AI Model</p>
                      <p className="text-[10px] text-zinc-400">1-click switch active synthesis engine</p>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                      Live
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                    {confirmedIntegrations.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-4">No confirmed providers yet.</p>
                    ) : (
                      confirmedIntegrations.map((integration) => (
                        <div key={integration.id} className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">
                            {integration.displayName}
                          </p>
                          <div className="space-y-0.5">
                            {integration.models.map((m: string) => {
                              const isCurrent = activeAiProvider === integration.provider && activeAiModel === m;
                              return (
                                <button
                                  key={m}
                                  onClick={() => handleQuickSwitchAI(integration.provider, m)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left ${
                                    isCurrent
                                      ? 'bg-blue-600 text-white font-bold'
                                      : 'hover:bg-zinc-100 text-zinc-700'
                                  }`}
                                >
                                  <span className="truncate">{m}</span>
                                  {isCurrent && <span className="text-[10px]">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => { setAiMenuOpen(false); navigate('/profile'); }}
                      className="w-full py-1.5 text-center text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      ⚙️ Manage AI Providers in Settings
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Deliverability Operational" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        isAdmin={isAdmin || hasOperatorClearance}
      />
    </div>
  );
};