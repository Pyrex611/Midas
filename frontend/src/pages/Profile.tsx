import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
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
  const { user, updateUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

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

      {/* User Info Card */}
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
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* UserSettings Component */}
      <UserSettings />

      {/* Campaigns Summary */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-8">Your Campaigns</h2>
      {campaigns.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">No campaigns yet.</p>
          <Link to="/campaigns" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            Go to Campaigns
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
    </div>
  );
};