import React, { useState, useEffect } from 'react';
import { userSettingsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export const UserSettings: React.FC = () => {
  const { toast } = useToast();
  const [sendLimit, setSendLimit] = useState(50);
  const [sendPeriod, setSendPeriod] = useState('day');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userSettingsAPI.get()
      .then(res => {
        if (res.data) {
          setSendLimit(res.data.sendLimit ?? 50);
          setSendPeriod(res.data.sendPeriod ?? 'day');
        }
      })
      .catch(() => {
        toast.error('Failed to load workspace throttling preferences', 'Error');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userSettingsAPI.update({
        sendLimit: Math.max(1, Number(sendLimit)),
        sendPeriod,
      });
      toast.success('Workspace throttling settings updated successfully', 'Preferences Saved');
    } catch {
      toast.error('Failed to update throttling settings', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-zinc-400">Loading delivery preferences...</div>;
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div>
        <h3 className="text-base font-black text-zinc-900 tracking-tight">Global Delivery Throttling</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Configure account-wide sending ceilings to enforce deliverability safety across all rotating mailboxes combined.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Account Maximum Send Ceiling
            </label>
            <input
              type="number"
              min="1"
              max="5000"
              value={sendLimit}
              onChange={(e) => setSendLimit(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              The queue engine pauses dispatches once this cumulative threshold is reached.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Throttling Period Window
            </label>
            <select
              value={sendPeriod}
              onChange={(e) => setSendPeriod(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none"
            >
              <option value="hour">Hourly Rate Limit</option>
              <option value="day">Daily Cumulative Limit</option>
            </select>
            <p className="mt-1 text-[11px] text-zinc-400">
              Select whether the ceiling resets every hour or at midnight UTC.
            </p>
          </div>
        </div>

        {/* Informational Guidance Tile */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-start gap-3">
          <div className="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
            i
          </div>
          <div className="text-xs text-zinc-600 leading-relaxed">
            <span className="font-bold text-zinc-900">Deliverability Note:</span> In addition to this global account ceiling, individual mailbox limits are respected per-sender (configured on the Sending Domains page). If an individual sender has a daily limit of 20, it will not exceed 20 sends regardless of the global ceiling.
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-zinc-100">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
          >
            {saving ? 'Updating Ceiling...' : 'Save Throttling Rules'}
          </button>
        </div>
      </form>
    </div>
  );
};