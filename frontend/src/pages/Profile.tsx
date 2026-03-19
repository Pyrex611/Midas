import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, mailboxAPI } from '../services/api';
import { UserSettings } from '../components/UserSettings';
import { MailboxForm } from '../components/MailboxForm';
import { MailboxStatsModal } from '../components/MailboxStatsModal'; // 🔥 Added Import
import { Link, useNavigate } from 'react-router-dom';

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
  const { user, updateUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'mailboxes' | 'settings'>('profile');

  // Mailboxes state
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [loadingMailboxes, setLoadingMailboxes] = useState(false);
  const [showMailboxForm, setShowMailboxForm] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<any>(null);
  const [selectedForStats, setSelectedForStats] = useState<any>(null); // 🔥 Added State

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await userAPI.getProfile();
        setCampaigns(res.data.campaigns);
        if (res.data.user.name !== user?.name) {
          updateUser({ name: res.data.user.name });
        }
      } catch (error) {
        console.error('Failed to load profile', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const fetchMailboxes = async () => {
    setLoadingMailboxes(true);
    try {
      const res = await mailboxAPI.getAll();
      setMailboxes(res.data);
    } catch (error) {
      console.error('Failed to load mailboxes', error);
    } finally {
      setLoadingMailboxes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mailboxes') {
      fetchMailboxes();
    }
  }, [activeTab]);

  const handleSaveName = async () => {
    setSaving(true);
    try {
      await userAPI.updateProfile({ name: newName });
      updateUser({ name: newName });
      setEditingName(false);
    } catch (error) {
      console.error('Failed to update name', error);
      alert('Could not update name');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteMailbox = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mailbox?')) return;
    try {
      await mailboxAPI.delete(id);
      fetchMailboxes();
    } catch (err) {
      alert('Failed to delete mailbox');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center py-12">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20 pb-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {['profile', 'mailboxes', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <>
          <div className="bg-white shadow rounded-2xl p-6 mb-8 border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Login Email</p>
                <p className="text-lg font-medium text-gray-900">{user?.email}</p>
              </div>
              <div className="flex items-center space-x-4">
                {editingName ? (
                  <>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Your name"
                    />
                    <button onClick={handleSaveName} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md font-bold">Save</button>
                    <button onClick={() => setEditingName(false)} className="px-4 py-2 bg-gray-100 text-gray-800 text-sm rounded-md">Cancel</button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Display Name</p>
                      <p className="text-lg font-medium text-gray-900">{user?.name || 'Not set'}</p>
                    </div>
                    <button onClick={() => setEditingName(true)} className="text-blue-600 hover:underline text-sm font-bold">Edit</button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-8 border-t pt-6 flex justify-end">
              <button onClick={handleLogout} className="px-6 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors">Sign Out</button>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-4">Active Campaigns</h2>
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} to={`/campaigns/${campaign.id}`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 group-hover:text-blue-600 truncate">{campaign.name}</p>
                  <div className="mt-1 flex flex-wrap gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    <span>📊 {campaign.leads} Leads</span>
                    <span>📤 {campaign.sentEmails} Sent</span>
                    <span className="text-blue-500">📈 {campaign.replyRate}% Reply</span>
                  </div>
                </div>
                {getStatusBadge(campaign.status)}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 🔥 UPDATED Mailboxes Tab */}
      {activeTab === 'mailboxes' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Your Sending Personas</h2>
            <button
              onClick={() => { setEditingMailbox(null); setShowMailboxForm(true); }}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              + Add Mailbox
            </button>
          </div>

          {loadingMailboxes ? (
            <div className="text-center py-12 text-gray-400">Syncing mailboxes...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mailboxes.map((mb) => (
                <div 
                  key={mb.id} 
                  className="bg-white border-2 border-gray-50 rounded-2xl p-5 hover:border-blue-200 transition-all cursor-pointer group relative"
                  onClick={() => setSelectedForStats(mb)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 truncate">{mb.name}</p>
                      <p className="text-xs text-gray-400 truncate font-medium">{mb.email}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${mb.status === 'HEALTHY' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  </div>

                  <div className="flex gap-3 mb-4">
                    <div className="bg-blue-50 px-2 py-1 rounded text-[10px] font-bold text-blue-600">
                      {mb.totalSent || 0} Sent
                    </div>
                    <div className="bg-green-50 px-2 py-1 rounded text-[10px] font-bold text-green-600">
                      {mb.replyCount || 0} Replies
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-50">
                    <span className="text-[9px] font-black text-blue-600 uppercase group-hover:underline">View Analytics →</span>
                    <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditingMailbox(mb); setShowMailboxForm(true); }} className="text-[10px] font-bold text-gray-400 hover:text-blue-600 uppercase">Edit</button>
                      <button onClick={() => handleDeleteMailbox(mb.id)} className="text-[10px] font-bold text-gray-400 hover:text-red-600 uppercase">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && <UserSettings />}

      {/* Modals */}
      <MailboxStatsModal 
        isOpen={!!selectedForStats} 
        onClose={() => setSelectedForStats(null)} 
        mailbox={selectedForStats} 
      />

      {showMailboxForm && (
        <MailboxForm
          mailbox={editingMailbox}
          onClose={() => setShowMailboxForm(false)}
          onSuccess={() => {
            setShowMailboxForm(false);
            fetchMailboxes();
          }}
        />
      )}
    </div>
  );
};