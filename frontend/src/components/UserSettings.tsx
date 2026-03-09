import React, { useState, useEffect } from 'react';
import { userSettingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const UserSettings: React.FC = () => {
  const { settings: contextSettings, updateSettings } = useAuth();
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Basic fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');

  // Send limit fields
  const [sendLimit, setSendLimit] = useState(50);
  const [sendPeriod, setSendPeriod] = useState('day');

  useEffect(() => {
    if (contextSettings) {
      setLocalSettings(contextSettings);
      if (contextSettings.emailFrom) {
        const match = contextSettings.emailFrom.match(/^"?([^"<]*)?"?\s*<(.+)>$/);
        if (match) {
          setDisplayName(match[1].trim() || '');
          setEmail(match[2].trim());
        } else {
          setEmail(contextSettings.emailFrom);
        }
      }
      if (contextSettings.smtpPass) setAppPassword('********');
      setSendLimit(contextSettings.sendLimit ?? 50);
      setSendPeriod(contextSettings.sendPeriod ?? 'day');
    }
  }, [contextSettings]);

  const handleAdvancedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {};

    if (email) {
      payload.emailFrom = displayName ? `"${displayName}" <${email}>` : email;
      payload.smtpUser = email;
      payload.imapUser = email;
    }

    if (appPassword && appPassword !== '********') {
      payload.smtpPass = appPassword;
      payload.imapPass = appPassword;
    }

    const advancedFields = [
      'smtpHost', 'smtpPort', 'smtpSecure',
      'imapHost', 'imapPort', 'imapSecure',
    ];
    for (const field of advancedFields) {
      if (localSettings[field] !== undefined) {
        payload[field] = localSettings[field];
      }
    }

    // Include send limit settings
    payload.sendLimit = sendLimit;
    payload.sendPeriod = sendPeriod;

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = buildPayload();
    try {
      await userSettingsAPI.update(payload);
      const updatedSettings = { ...contextSettings, ...payload };
      if (payload.smtpPass) {
        updatedSettings.smtpPass = '********';
        updatedSettings.imapPass = '********';
      }
      setLocalSettings(updatedSettings);
      updateSettings(updatedSettings);

      if (appPassword && appPassword !== '********') {
        setAppPassword('********');
      }

      alert('Settings saved successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-500">Loading settings...</div>;

  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Email & IMAP Settings</h3>
      <p className="text-sm text-gray-600 mb-4">
        Configure your Gmail account to send and receive emails. You only need your display name, email, and an app password.
      </p>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Settings */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-3">Basic Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
                placeholder="Your Name"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
                placeholder="you@gmail.com"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600">App Password</label>
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
                placeholder={appPassword === '********' ? '********' : 'Enter app password'}
              />
              <p className="text-xs text-gray-500 mt-1">
                Generate an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600">app password</a> for Gmail.
              </p>
            </div>
          </div>
        </div>

        {/* Send Limit Settings */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-3">Send Limits</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Maximum emails per period</label>
              <input
                type="number"
                min="1"
                value={sendLimit}
                onChange={(e) => setSendLimit(parseInt(e.target.value) || 1)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Period</label>
              <select
                value={sendPeriod}
                onChange={(e) => setSendPeriod(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Emails will be sent at a rate that respects this limit. Replies are sent immediately.
          </p>
        </div>

        {/* Advanced Settings Toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
          >
            {showAdvanced ? '▼ Hide advanced settings' : '▶ Show advanced settings'}
          </button>
        </div>

        {showAdvanced && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-3">Advanced SMTP/IMAP Settings</h4>
            <p className="text-xs text-gray-500 mb-3">Override the default Gmail settings if needed.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600">SMTP Host</label>
                <input
                  type="text"
                  name="smtpHost"
                  value={localSettings.smtpHost || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">SMTP Port</label>
                <input
                  type="number"
                  name="smtpPort"
                  value={localSettings.smtpPort || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex items-center mt-6">
                <input
                  type="checkbox"
                  name="smtpSecure"
                  checked={localSettings.smtpSecure || false}
                  onChange={handleAdvancedChange}
                  className="h-4 w-4 text-blue-600"
                />
                <label className="ml-2 text-sm text-gray-600">Use SSL (port 465)</label>
              </div>
              <div>
                <label className="block text-sm text-gray-600">SMTP Username</label>
                <input
                  type="text"
                  name="smtpUser"
                  value={localSettings.smtpUser || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">SMTP Password (override)</label>
                <input
                  type="password"
                  name="smtpPass"
                  value={localSettings.smtpPass === '********' ? '' : localSettings.smtpPass || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                  placeholder={localSettings.smtpPass ? '********' : 'Enter new password'}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">IMAP Host</label>
                <input
                  type="text"
                  name="imapHost"
                  value={localSettings.imapHost || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">IMAP Port</label>
                <input
                  type="number"
                  name="imapPort"
                  value={localSettings.imapPort || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex items-center mt-6">
                <input
                  type="checkbox"
                  name="imapSecure"
                  checked={localSettings.imapSecure || false}
                  onChange={handleAdvancedChange}
                  className="h-4 w-4 text-blue-600"
                />
                <label className="ml-2 text-sm text-gray-600">Use SSL</label>
              </div>
              <div>
                <label className="block text-sm text-gray-600">IMAP Username</label>
                <input
                  type="text"
                  name="imapUser"
                  value={localSettings.imapUser || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">IMAP Password (override)</label>
                <input
                  type="password"
                  name="imapPass"
                  value={localSettings.imapPass === '********' ? '' : localSettings.imapPass || ''}
                  onChange={handleAdvancedChange}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                  placeholder={localSettings.imapPass ? '********' : 'Enter new password'}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};