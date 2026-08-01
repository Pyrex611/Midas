import React, { useState, useEffect } from 'react';
import { userSettingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const UserSettings: React.FC = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [sendLimit, setSendLimit] = useState(50);
  const [sendPeriod, setSendPeriod] = useState('day');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    userSettingsAPI.get().then(res => {
      if (res.data) {
        setSendLimit(res.data.sendLimit ?? 50);
        setSendPeriod(res.data.sendPeriod ?? 'day');
      }
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await userSettingsAPI.update({ sendLimit, sendPeriod });
      setMessage('Settings updated successfully');
    } catch (err) {
      setMessage('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Workspace Settings</h3>

      {message && <div className="bg-blue-50 text-blue-800 p-3 rounded mb-4 text-sm">{message}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Daily Max Emails per Subdomain</label>
            <input
              type="number"
              min="1"
              value={sendLimit}
              onChange={(e) => setSendLimit(parseInt(e.target.value) || 1)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Throttling Period</label>
            <select
              value={sendPeriod}
              onChange={(e) => setSendPeriod(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};