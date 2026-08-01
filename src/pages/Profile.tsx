import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, domainAPI } from '../services/api';
import { UserSettings } from '../components/UserSettings';
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'domains' | 'settings'>('profile');

  // Domains state
  const [domains, setDomains] = useState<any[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await userAPI.getProfile();
        setCampaigns(res.data.campaigns || []);
        if (res.data.user?.name) {
          setNewName(res.data.user.name);
        }
      } catch (error) {
        console.error('Failed to load profile', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const fetchDomains = async () => {
    setLoadingDomains(true);
    try {
      const res = await domainAPI.getAll();
      setDomains(res.data);
    } catch (error) {
      console.error('Failed to load domains', error);
    } finally {
      setLoadingDomains(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'domains') {
      fetchDomains();
    }
  }, [activeTab]);

  const handleSaveName = async () => {
    setSaving(true);
    try {
      await userAPI.updateProfile({ name: newName });
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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('domains')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'domains'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sending Domains
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settings
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <>
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-lg font-medium text-gray-900">{user?.email}</p>
              </div>
              <div className="flex items-center space-x-4">
                {editingName ? (
                  <>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="border rounded-md px-3 py-2 text-sm"
                      placeholder="Your name"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">Display Name</p>
                      <p className="text-lg font-medium text-gray-900">{user?.name || 'Not set'}</p>
                    </div>
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-6 border-t pt-4 flex justify-end">
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <p className="text-gray-500">No campaigns created yet.</p>
              <Link to="/campaigns" className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium">
                Go to Campaigns →
              </Link>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {campaigns.map((campaign) => (
                  <li key={campaign.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <Link to={`/campaigns/${campaign.id}`} className="block">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-medium text-blue-600 truncate">{campaign.name}</p>
                          <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                            <span>📊 {campaign.leads} leads</span>
                            <span>📝 {campaign.drafts} drafts</span>
                            <span>📤 {campaign.sentEmails} sent</span>
                            <span>💬 {campaign.replies} replies</span>
                            <span>📈 {campaign.replyRate}% reply rate</span>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          {getStatusBadge(campaign.status)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Domains Tab */}
      {activeTab === 'domains' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Sending Domains</h2>
            <Link to="/domains" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              Manage Domains →
            </Link>
          </div>

          {loadingDomains ? (
            <div className="text-center py-12">Loading domains...</div>
          ) : domains.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No domains connected yet. <Link to="/domains" className="text-blue-600 hover:underline">Add a subdomain</Link> to start sending emails.
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((d) => (
                <div key={d.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="text-lg font-medium text-gray-900">{d.domainName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${d.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Warmup Day {d.warmupDay} | Daily Limit: {d.dailyLimit} | Bounce Rate: {(d.bounceRate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && <UserSettings />}
    </div>
  );
};