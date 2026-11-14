import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { campaignAPI, getErrorMessage } from '../services/api';
import { CreateCampaignModal } from '../components/CreateCampaignModal';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  context: string | null;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  _count: {
    leads: number;
    emails: number;
    drafts: number;
  };
  members?: { role: string }[];
  role?: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export const Campaigns: React.FC = () => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [campRes, inviteRes] = await Promise.all([
        campaignAPI.getAll(),
        campaignAPI.getMyInvites(),
      ]);
      setCampaigns(campRes.data || []);
      setInvites(inviteRes.data || []);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load campaigns'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleAcceptInvite = async (token: string) => {
    setAcceptingToken(token);
    try {
      await campaignAPI.acceptInvite(token);
      toast.success('Joined shared campaign workspace', 'Invitation Accepted');
      await fetchAllData();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to accept invitation'), 'Error');
    } finally {
      setAcceptingToken(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-thistle-100 text-royal-700 border border-thistle-300',
      ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      PAUSED: 'bg-amber-50 text-amber-800 border border-gold-400/50',
      COMPLETED: 'bg-royal-700 text-white border border-gold-400/40',
      FAILED: 'bg-rose-50 text-rose-700 border border-rose-200',
    };
    return (
      <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${colors[status] || colors.DRAFT}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-thistle-500 uppercase tracking-wider">Pending Invitations</h2>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="card-midas border-l-4 border-l-gold-500 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-thistle-100 text-royal-700 border border-gold-500/35 flex items-center justify-center">
                  <Icons.Users />
                </div>
                <div>
                  <p className="text-xs text-royal-950">
                    <span className="font-bold">{invite.sender?.name || invite.sender?.email}</span> invited you to join{' '}
                    <span className="font-bold text-royal-700">"{invite.campaign?.name}"</span>
                  </p>
                  <p className="text-[11px] text-thistle-500 mt-0.5">Assigned Role: {invite.role}</p>
                </div>
              </div>
              <button
                onClick={() => handleAcceptInvite(invite.token)}
                disabled={!!acceptingToken}
                className="px-4 py-2 btn-royal text-xs font-bold rounded-xl"
              >
                {acceptingToken === invite.token ? 'Joining...' : 'Accept & Join'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header with Golden Bottom Separator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gold-500/40">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-royal-950 tracking-tight">Campaigns</h1>
          <p className="text-xs text-thistle-500 mt-1">Manage automated cold outbound sequences, AI drafts, and mailbox rotations.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 btn-royal text-xs font-bold rounded-xl flex items-center gap-1.5"
        >
          <Icons.Plus className="text-gold-300" />
          <span>New Campaign</span>
        </button>
      </div>

      {loading && (
        <div className="card-midas rounded-2xl p-12 text-center text-xs text-thistle-500">
          Loading campaigns...
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 px-5 py-4 rounded-2xl text-xs space-y-2">
          <p className="font-bold">Error loading campaigns</p>
          <p>{error}</p>
          <button
            onClick={fetchAllData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className="card-midas rounded-2xl p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-thistle-100 text-royal-700 border border-gold-500/35 mx-auto flex items-center justify-center">
            <Icons.Campaigns className="text-xl text-gold-600" />
          </div>
          <h3 className="text-base font-bold text-royal-950">No campaigns yet</h3>
          <p className="text-xs text-thistle-500 max-w-sm mx-auto">
            Get started by launching your first outbound sequence or accepting a team collaboration invite.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 btn-royal text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
          >
            <Icons.Plus className="text-gold-300" />
            <span>Create Campaign</span>
          </button>
        </div>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className="bg-white rounded-2xl border border-gold-500/40 shadow-xs overflow-hidden">
          <ul className="divide-y divide-gold-500/25">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link to={`/campaigns/${campaign.id}`} className="block hover:bg-thistle-50/80 transition-colors">
                  <div className="px-5 py-4 sm:px-6 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-royal-800 truncate flex items-center gap-2">
                          <span>{campaign.name}</span>
                          {campaign.role && campaign.role !== 'OWNER' && (
                            <span className="bg-thistle-100 text-royal-700 border border-gold-500/35 text-[10px] uppercase px-2 py-0.5 rounded font-bold">
                              {campaign.role}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-thistle-500 line-clamp-1 italic">
                          {campaign.context || campaign.description || 'No strategy context provided'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {getStatusBadge(campaign.status)}
                        <span className="text-xs text-royal-800 font-bold bg-thistle-50 px-2.5 py-0.5 rounded-lg border border-gold-500/30">
                          {campaign._count.leads} Leads
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between text-[11px] text-thistle-500 pt-2 border-t border-gold-500/20">
                      <div className="flex flex-wrap gap-3">
                        <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                        {campaign.startedAt && (
                          <span className="text-emerald-700 font-semibold">
                            Active since: {new Date(campaign.startedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 sm:mt-0 font-bold text-royal-700 flex items-center gap-1.5">
                        <Icons.Send className="text-gold-600" />
                        <span>{campaign._count.emails} total emails sent</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchAllData();
        }}
      />
    </div>
  );
};