import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, domainAPI, senderAPI, userSettingsAPI } from '../services/api';
import { UserSettings } from '../components/UserSettings';
import { WebhookSettings } from '../components/settings/WebhookSettings';
import { ApiKeySettings } from '../components/settings/ApiKeySettings';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

interface CampaignStat {
  id: string;
  name: string;
  status: string;
  leads: number;
  drafts: number;
  sentEmails: number;
  replies: number;
  replyRate: number;
}

export const Profile: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const activeTab = (searchParams.get('tab') as any) || 'profile';
  const setActiveTab = (tab: string) => setSearchParams({ tab });

  // Domains & Dedicated Newsletter Sender
  const [domains, setDomains] = useState<any[]>([]);
  const [allSenders, setAllSenders] = useState<any[]>([]);
  const [dedicatedSenderId, setDedicatedSenderId] = useState<string>('');
  const [savingSender, setSavingSender] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileRes, domainsRes, sendersRes, settingsRes] = await Promise.all([
          userAPI.getProfile(),
          domainAPI.getAll().catch(() => ({ data: [] })),
          senderAPI.listAll().catch(() => ({ data: [] })),
          userSettingsAPI.get().catch(() => ({ data: {} })),
        ]);
        setCampaigns(profileRes.data?.campaigns || []);
        setDomains(domainsRes.data || []);
        setAllSenders(sendersRes.data || []);
        setDedicatedSenderId(settingsRes.data?.dedicatedNewsletterSenderId || '');
        if (profileRes.data?.user?.name) {
          setNewName(profileRes.data.user.name);
        }
      } catch {
        toast.error('Failed to load user profile details', 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      return toast.warning('Display name must be at least 2 characters', 'Validation');
    }

    setSaving(true);
    try {
      await userAPI.updateProfile({ name: trimmed });
      setEditingName(false);
      toast.success('Your display name was updated', 'Profile Updated');
    } catch {
      toast.error('Could not update display name', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDedicatedSender = async (senderId: string) => {
    setDedicatedSenderId(senderId);
    setSavingSender(true);
    try {
      await userSettingsAPI.update({
        dedicatedNewsletterSenderId: senderId || null,
      });
      toast.success('Dedicated newsletter sender isolated', 'Sender Bound');
    } catch {
      toast.error('Failed to update dedicated sender', 'Error');
    } finally {
      setSavingSender(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">ACTIVE</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">COMPLETED</span>;
      case 'PAUSED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">PAUSED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">{status}</span>;
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-xs text-zinc-400">Loading user profile...</div>;
  }

  const initialLetter = (user?.name || user?.email || 'M').charAt(0).toUpperCase();

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Account & Workspace</h1>
          <p className="text-xs text-zinc-500 mt-1">Manage personal credentials, API keys, delivery throttling, and outbound webhooks.</p>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors shadow-xs"
        >
          Sign Out of Midas
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {[
            ['profile', 'Operator Profile'],
            ['settings', 'Settings & AI Studio'],
            ['apiKeys', 'Developer API Keys'],
            ['webhooks', 'Webhooks (CRM Sync)'],
            ['domains', `Sending Infrastructure (${domains.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-3 px-1 border-b-2 text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: OPERATOR PROFILE */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 text-white font-black text-xl flex items-center justify-center shadow-sm">
                {initialLetter}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900">{user?.name || 'Midas Operator'}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-600">
                    VERIFIED
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {editingName ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Your display name"
                    className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-3.5 py-1.5 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Edit Display Name
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 tracking-tight">Active Sequences Performance</h3>
                <p className="text-xs text-zinc-500 mt-0.5">High-level conversion and reply rates across your account campaigns.</p>
              </div>
              <Link to="/campaigns" className="text-xs font-bold text-blue-600 hover:underline">
                View All Sequences →
              </Link>
            </div>

            {campaigns.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400 bg-zinc-50 rounded-xl border border-zinc-100">
                No active campaigns created yet. Launch an outreach campaign to view conversion metrics.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {campaigns.map((c) => (
                  <div key={c.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <Link to={`/campaigns/${c.id}`} className="text-xs font-bold text-zinc-900 hover:text-blue-600 transition-colors">
                        {c.name}
                      </Link>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
                        <span>Leads: <strong className="text-zinc-700 font-bold">{c.leads}</strong></span>
                        <span>Sent: <strong className="text-zinc-700 font-bold">{c.sentEmails}</strong></span>
                        <span>Replies: <strong className="text-zinc-700 font-bold">{c.replies}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                          {c.replyRate}% Reply Rate
                        </span>
                      </div>
                      <div>{getStatusBadge(c.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WORKSPACE SETTINGS & AI STUDIO */}
      {activeTab === 'settings' && <UserSettings />}

      {/* TAB 3: DEVELOPER API KEYS (RELOCATED FROM TOWN CRIER) */}
      {activeTab === 'apiKeys' && <ApiKeySettings />}

      {/* TAB 4: BI-DIRECTIONAL OUTBOUND WEBHOOKS */}
      {activeTab === 'webhooks' && <WebhookSettings />}

      {/* TAB 5: SENDING INFRASTRUCTURE SNAPSHOT */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-zinc-900 tracking-tight">Dedicated Newsletter Sender (Domain Isolation)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Assign a dedicated mailbox identity to send all Town Crier broadcasts and welcome autoresponders, completely isolating newsletters from cold sales sender rotation.
              </p>
            </div>

            <div className="max-w-md">
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Select Dedicated Newsletter Sender</label>
              <select
                value={dedicatedSenderId}
                onChange={(e) => handleSaveDedicatedSender(e.target.value)}
                disabled={savingSender}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold focus:outline-none"
              >
                <option value="">-- None (Fair-Share 50% Rotation across all senders) --</option>
                {allSenders.filter((s: any) => s.status === 'active' && s.domain?.status === 'active').map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.localPart}@{s.domain?.domainName} ({s.displayName || 'No Name'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 tracking-tight">Active Sending Domains</h3>
                <p className="text-xs text-zinc-500 mt-0.5">DNS identity and authenticated Mailgun domains linked to this account.</p>
              </div>
              <Link
                to="/domains"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Manage Domains Hub →
              </Link>
            </div>

            {domains.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400 bg-zinc-50 rounded-xl border border-zinc-100">
                No sending domains connected yet. Authenticate a Mailgun domain to enable outreach.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {domains.map((d) => (
                  <div key={d.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-zinc-900">{d.domainName}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                        d.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Mailboxes: {d.senders?.length || 0} active · Bounce rate: {((d.bounceRate || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};