import React, { useEffect, useState } from 'react';
import { townCrierAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { TownCrierHeader } from '../components/townCrier/TownCrierHeader';
import { TownCrierAnalytics } from '../components/townCrier/TownCrierAnalytics';
import { TownCrierBroadcastsTab } from '../components/townCrier/tabs/TownCrierBroadcastsTab';
import { TownCrierGongsTab } from '../components/townCrier/tabs/TownCrierGongsTab';
import { TownCrierAudienceTab } from '../components/townCrier/tabs/TownCrierAudienceTab';
import { TownCrierComposerDrawer } from '../components/townCrier/drawers/TownCrierComposerDrawer';
import { TownCrierGongDrawer } from '../components/townCrier/drawers/TownCrierGongDrawer';
import { TownCrierAddRecipientDrawer } from '../components/townCrier/drawers/TownCrierAddRecipientDrawer';
import { TownCrierEmbedDrawer } from '../components/townCrier/drawers/TownCrierEmbedDrawer';
import { GongQuickstartModal } from '../components/townCrier/GongQuickstartModal';

type Tab = 'broadcasts' | 'gongs' | 'audience';

export const TownCrier: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('broadcasts');

  const [analytics, setAnalytics] = useState<any>({
    totalSubscribers: 0,
    netGrowth30d: 0,
    churnRate: 0,
    broadcastsCount: 0,
    totalSent: 0,
  });

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);

  const [gongs, setGongs] = useState<any[]>([]);
  const [loadingGongs, setLoadingGongs] = useState(false);
  const [editingGong, setEditingGong] = useState<any | null>(null);

  // Supabase-Style Instant Quickstart Modal State
  const [quickstartGong, setQuickstartGong] = useState<any | null>(null);

  const [recipients, setRecipients] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Drawers
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isGongDrawerOpen, setIsGongDrawerOpen] = useState(false);
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);
  const [isEmbedDrawerOpen, setIsEmbedDrawerOpen] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const res = await townCrierAPI.getAnalytics();
      setAnalytics(res.data);
    } catch {}
  };

  const fetchBroadcasts = async () => {
    try {
      const res = await townCrierAPI.getBroadcasts();
      setBroadcasts(res.data || []);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load broadcasts'), 'Network Error');
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const fetchGongs = async () => {
    setLoadingGongs(true);
    try {
      const res = await townCrierAPI.getGongs();
      setGongs(res.data?.gongs || []);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load Gong channels'), 'Error');
    } finally {
      setLoadingGongs(false);
    }
  };

  const fetchRecipients = async (page = pagination.page) => {
    setLoadingAudience(true);
    try {
      const res = await townCrierAPI.getRecipients(page, pagination.pageSize);
      setRecipients(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load audience'), 'Network Error');
    } finally {
      setLoadingAudience(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    if (activeTab === 'broadcasts') fetchBroadcasts();
    if (activeTab === 'gongs') fetchGongs();
    if (activeTab === 'audience') fetchRecipients(1);
  }, [activeTab]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <TownCrierHeader
        activeTab={activeTab}
        onOpenComposer={() => setIsComposerOpen(true)}
        onOpenAddRecipient={() => setIsAddRecipientOpen(true)}
        onOpenCreateGong={() => {
          setEditingGong(null);
          setIsGongDrawerOpen(true);
        }}
        onOpenEmbedDrawer={() => setIsEmbedDrawerOpen(true)}
        onRefreshAudience={() => {
          fetchRecipients(1);
          fetchAnalytics();
        }}
      />

      <TownCrierAnalytics analytics={analytics} />

      <div className="border-b border-zinc-200">
        <nav className="flex space-x-8">
          {[
            ['broadcasts', 'Broadcasts'],
            ['gongs', `Gongs / Channels (${gongs.length})`],
            ['audience', `Audience (${pagination.total || 0})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as Tab)}
              className={`py-3 px-1 border-b-2 text-xs font-bold transition-colors ${
                activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'broadcasts' && (
        <TownCrierBroadcastsTab
          broadcasts={broadcasts}
          loading={loadingBroadcasts}
          onOpenComposer={() => setIsComposerOpen(true)}
          onRefresh={() => {
            fetchBroadcasts();
            fetchAnalytics();
          }}
        />
      )}

      {activeTab === 'gongs' && (
        <TownCrierGongsTab
          gongs={gongs}
          loading={loadingGongs}
          onOpenCreateGong={() => {
            setEditingGong(null);
            setIsGongDrawerOpen(true);
          }}
          onEditGong={(gong) => {
            setEditingGong(gong);
            setIsGongDrawerOpen(true);
          }}
          onOpenQuickstart={(gong) => setQuickstartGong(gong)}
        />
      )}

      {activeTab === 'audience' && (
        <TownCrierAudienceTab
          recipients={recipients}
          pagination={pagination}
          loading={loadingAudience}
          onPageChange={(p) => fetchRecipients(p)}
          onOpenAddRecipient={() => setIsAddRecipientOpen(true)}
          onRefresh={() => {
            fetchRecipients(pagination.page);
            fetchAnalytics();
          }}
        />
      )}

      {/* Gong Setup & In-Place Mailbox Creation Drawer */}
      <TownCrierGongDrawer
        isOpen={isGongDrawerOpen}
        onClose={() => setIsGongDrawerOpen(false)}
        editingGong={editingGong}
        onSuccess={(savedGong) => {
          fetchGongs();
          fetchAnalytics();
          setQuickstartGong(savedGong);
        }}
      />

      {/* Supabase-Style Quickstart Modal: Shown Immediately on Gong Creation */}
      <GongQuickstartModal
        isOpen={Boolean(quickstartGong)}
        onClose={() => setQuickstartGong(null)}
        gong={quickstartGong}
      />

      {/* Broadcast Composer */}
      <TownCrierComposerDrawer
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onSuccess={() => {
          fetchBroadcasts();
          fetchAnalytics();
        }}
      />

      {/* Add Single Subscriber */}
      <TownCrierAddRecipientDrawer
        isOpen={isAddRecipientOpen}
        onClose={() => setIsAddRecipientOpen(false)}
        onSuccess={() => {
          fetchRecipients(1);
          fetchAnalytics();
        }}
      />

      {/* Multi-Environment SDK & Modal Embed Drawer */}
      <TownCrierEmbedDrawer
        isOpen={isEmbedDrawerOpen}
        onClose={() => setIsEmbedDrawerOpen(false)}
      />
    </div>
  );
};