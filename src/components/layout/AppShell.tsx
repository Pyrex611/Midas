import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { userAPI, domainAPI, aiAPI, notificationAPI } from '../../services/api';
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

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

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

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationAPI.get(15);
      const items: any[] = res.data?.notifications || [];
      const unread: number = res.data?.unreadCount || 0;

      setNotifications(items);
      setUnreadNotifCount(unread);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        items.forEach((notif) => {
          if (!notif.isRead && !seenNotifIdsRef.current.has(notif.id)) {
            seenNotifIdsRef.current.add(notif.id);
            const isFresh = Date.now() - new Date(notif.createdAt).getTime() < 3 * 60 * 1000;
            if (isFresh) {
              const desktopAlert = new Notification(notif.title, {
                body: notif.message,
                icon: '/vite.svg',
              });
              desktopAlert.onclick = () => {
                window.focus();
                if (notif.link) navigate(notif.link);
              };
            }
          }
        });
      }
    } catch {}
  }, [navigate]);

  useEffect(() => {
    userAPI
      .getProfile()
      .then((res) => setIsAdmin(!!res.data?.user?.isAdmin))
      .catch(() => setIsAdmin(false));

    checkClearanceState();
    fetchAIState();
    fetchNotifications();

    domainAPI
      .getAll()
      .then((res) => {
        const active = (res.data || []).filter((d: any) => d.status === 'active').length;
        setActiveDomainsCount(active);
      })
      .catch(() => {});

    const notifInterval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(notifInterval);
  }, [location.pathname, fetchNotifications]);

  useEffect(() => {
    const handleSyncEvents = () => {
      checkClearanceState();
      fetchAIState();
      fetchNotifications();
    };

    window.addEventListener('operator_auth_changed', handleSyncEvents);
    window.addEventListener('ai_config_changed', handleSyncEvents);
    window.addEventListener('storage', handleSyncEvents);

    return () => {
      window.removeEventListener('operator_auth_changed', handleSyncEvents);
      window.removeEventListener('ai_config_changed', handleSyncEvents);
      window.removeEventListener('storage', handleSyncEvents);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifMenuOpen(false);
      }
    };
    if (aiMenuOpen || notifMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [aiMenuOpen, notifMenuOpen]);

  const requestDesktopNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return toast.warning('Your browser does not support desktop notifications', 'Not Supported');
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Desktop alerts enabled for new prospect replies', 'Alerts Enabled');
        new Notification('Midas Desktop Alerts Active', {
          body: 'You will receive immediate popups when leads reply or deliverability alerts trigger.',
          icon: '/vite.svg',
        });
      } else {
        toast.info('Desktop notifications were disabled or dismissed', 'Notifications');
      }
    } catch {
      toast.error('Could not request notification permissions', 'Error');
    }
  };

  const handleMarkNotifRead = async (id: string, link?: string) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
      if (link) {
        setNotifMenuOpen(false);
        navigate(link);
      }
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
      toast.success('All notifications marked as read', 'Cleared');
    } catch {}
  };

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

  // Developer Docs intentionally omitted from sidebar; accessible via Command Palette (Cmd+K) & /docs
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
    <div className="min-h-screen bg-thistle-canvas flex flex-col md:flex-row">
      {/* Desktop Persistent Sticky Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-gold-500/40 bg-white/95 backdrop-blur-sm transition-all duration-200 z-30 select-none ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="h-16 flex-shrink-0 px-6 border-b border-gold-500/40 flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <span className="text-xl font-black bg-gradient-to-r from-royal-700 via-royal-600 to-gold-500 bg-clip-text text-transparent tracking-wider">
                MIDAS
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-thistle-100 text-royal-700 border border-gold-500/35 px-1.5 py-0.5 rounded-md">
                PROD
              </span>
            </div>
          ) : (
            <span className="text-xl font-black bg-gradient-to-br from-royal-700 to-gold-500 bg-clip-text text-transparent mx-auto">
              M
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            className="text-thistle-500 hover:text-royal-700 p-1.5 rounded-lg hover:bg-thistle-100 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <span className={`inline-block transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}>
              <Icons.ChevronLeft />
            </span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all border ${
                  isActive
                    ? 'bg-royal-700 text-white border-gold-400/60 font-bold shadow-sm'
                    : 'border-transparent text-royal-950/75 hover:bg-thistle-100/80 hover:text-royal-800 hover:border-gold-500/35'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={isActive ? 'text-gold-300' : 'text-thistle-500'}>{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Anchored Footer with Golden Top Separator */}
        <div className="flex-shrink-0 p-3 border-t border-gold-500/40 bg-white space-y-2">
          {!collapsed && (
            <div className="p-3 bg-royal-950 text-white rounded-xl border border-gold-500/40 glow-gold-hover">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-300">
                  Deliverability Pulse
                </span>
                <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
              </div>
              <p className="text-xs font-bold text-white">
                {activeDomainsCount} Domains Operating
              </p>
              <p className="text-[10px] text-thistle-300/80">Circuit breakers armed</p>
            </div>
          )}

          <Link
            to="/profile"
            className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors border ${
              location.pathname === '/profile'
                ? 'bg-royal-700 text-white border-gold-400/60'
                : 'border-transparent hover:bg-thistle-100/70 text-royal-950/80 hover:border-gold-500/35'
            }`}
            title={collapsed ? 'Settings & Profile' : undefined}
          >
            <span className={location.pathname === '/profile' ? 'text-gold-300' : 'text-thistle-500'}>
              <Icons.Profile />
            </span>
            {!collapsed && <span className="text-xs font-bold">Settings &amp; Profile</span>}
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative w-72 max-w-[80vw] h-[100dvh] bg-white shadow-2xl border-r border-gold-500/40 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="h-16 px-6 border-b border-gold-500/40 flex items-center justify-between">
                <span className="text-xl font-black bg-gradient-to-r from-royal-700 to-gold-500 bg-clip-text text-transparent tracking-wider">
                  MIDAS
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-thistle-500 hover:text-royal-800 rounded-lg"
                >
                  <Icons.Close />
                </button>
              </div>

              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                        isActive
                          ? 'bg-royal-700 text-white font-bold border border-gold-400/50'
                          : 'text-royal-950/75 hover:bg-thistle-100 hover:text-royal-800'
                      }`}
                    >
                      <span className={isActive ? 'text-gold-300' : 'text-thistle-500'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-gold-500/40 space-y-3">
              <div className="p-3 bg-royal-950 text-white rounded-xl border border-gold-500/40">
                <p className="text-[10px] font-bold uppercase tracking-wider text-thistle-300">Deliverability Pulse</p>
                <p className="text-xs font-bold text-white mt-0.5">{activeDomainsCount} Domains Active</p>
              </div>

              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-2 rounded-xl text-royal-950 font-bold text-xs hover:bg-thistle-100"
              >
                <span className="text-thistle-500"><Icons.Profile /></span>
                <span>Settings &amp; Profile</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Viewport Header with Golden Bottom Separator */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/85 backdrop-blur-md border-b border-gold-500/40 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-royal-700 hover:text-royal-950 rounded-lg md:hidden"
              title="Open Navigation Menu"
            >
              <Icons.Menu />
            </button>

            <span className="text-xs font-black uppercase tracking-wider text-royal-700 hidden sm:inline-block">
              {getBreadcrumbs()}
            </span>

            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-thistle-canvas hover:bg-thistle-100 border border-gold-500/35 text-xs text-royal-800 glow-gold-hover ml-1"
            >
              <Icons.Search className="text-gold-600" />
              <span className="font-semibold">Quick Actions &amp; Docs</span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-royal-800 border border-gold-500/35">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notification Bell */}
            <div className="relative" ref={notifMenuRef}>
              <button
                onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                className="relative p-2 rounded-xl border border-gold-500/35 bg-white hover:bg-thistle-50 text-royal-700 glow-gold-hover"
                title="Notifications & Live Alerts"
              >
                <Icons.Bell />

                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white shadow-xs animate-in zoom-in-50">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {notifMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gold-500/45 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2">
                  <div className="px-3 py-2 border-b border-gold-500/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-royal-950">Priority Notifications</p>
                      <p className="text-[10px] text-thistle-500">Prospect replies &amp; deliverability health</p>
                    </div>
                    {unreadNotifCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-royal-700 hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                    <div className="p-2.5 bg-thistle-50 border border-gold-500/30 rounded-xl flex items-center justify-between text-xs text-royal-950">
                      <span className="text-[11px] font-medium">Get desktop alert popups?</span>
                      <button
                        onClick={requestDesktopNotificationPermission}
                        className="px-2.5 py-1 btn-royal rounded-lg text-[10px] font-bold"
                      >
                        Enable Alerts
                      </button>
                    </div>
                  )}

                  <div className="max-h-80 overflow-y-auto space-y-1 p-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-thistle-500 text-center py-8">No notifications recorded yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkNotifRead(n.id, n.link)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-colors space-y-1 ${
                            n.isRead
                              ? 'bg-white border-transparent hover:bg-thistle-50'
                              : n.type === 'URGENT'
                              ? 'bg-rose-50/70 border-rose-300 hover:bg-rose-50'
                              : 'bg-thistle-100/70 border-gold-500/40 hover:bg-thistle-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              n.type === 'URGENT'
                                ? 'text-rose-700'
                                : n.type === 'INBOUND_REPLY'
                                ? 'text-royal-700'
                                : 'text-thistle-500'
                            }`}>
                              {n.type === 'INBOUND_REPLY' ? 'Prospect Reply' : n.type}
                            </span>
                            <span className="text-[10px] text-thistle-500">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-royal-950">{n.title}</p>
                          <p className="text-[11px] text-royal-800/80 line-clamp-2">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI Model Switcher */}
            <div className="relative" ref={aiMenuRef}>
              <button
                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-thistle-100/80 hover:bg-thistle-200/70 border border-gold-500/40 text-xs font-bold text-royal-800 glow-gold-hover group"
                title="Active AI Provider & Model (Click to Switch)"
              >
                <span className="text-gold-600">
                  <Icons.Sparkles />
                </span>
                <span className="max-w-[140px] sm:max-w-[200px] truncate">
                  {activeAiModel.split('/').pop()}
                </span>
                <span className="text-[10px] opacity-60">▾</span>
              </button>

              {aiMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gold-500/45 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2">
                  <div className="px-3 py-2 border-b border-gold-500/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-royal-950">Active AI Model</p>
                      <p className="text-[10px] text-thistle-500">1-click switch active synthesis engine</p>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                      Live
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                    {confirmedIntegrations.length === 0 ? (
                      <p className="text-xs text-thistle-500 text-center py-4">No confirmed providers yet.</p>
                    ) : (
                      confirmedIntegrations.map((integration) => (
                        <div key={integration.id} className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 px-2">
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
                                      ? 'bg-royal-700 text-white font-bold border border-gold-400/50'
                                      : 'hover:bg-thistle-50 text-royal-950'
                                  }`}
                                >
                                  <span className="truncate">{m}</span>
                                  {isCurrent && <Icons.CheckCircle className="text-gold-300" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-gold-500/30">
                    <button
                      onClick={() => { setAiMenuOpen(false); navigate('/profile?tab=settings'); }}
                      className="w-full py-1.5 text-center text-xs font-bold text-royal-700 hover:bg-thistle-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Icons.Settings />
                      <span>Manage AI Providers in Settings</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="w-2 h-2 rounded-full bg-gold-500 shadow-xs" title="Deliverability Operational" />
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