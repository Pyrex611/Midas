import React, { useState, useEffect } from 'react';
import { userSettingsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export const UserSettings: React.FC = () => {
  const { toast } = useToast();
  const [sendLimit, setSendLimit] = useState(50);
  const [sendPeriod, setSendPeriod] = useState('day');
  const [companyName, setCompanyName] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [customOptOutText, setCustomOptOutText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userSettingsAPI.get()
      .then(res => {
        if (res.data) {
          setSendLimit(res.data.sendLimit ?? 50);
          setSendPeriod(res.data.sendPeriod ?? 'day');
          setCompanyName(res.data.companyName ?? '');
          setPhysicalAddress(res.data.physicalAddress ?? '');
          setCustomOptOutText(res.data.customOptOutText ?? '');
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
        companyName: companyName.trim() || null,
        physicalAddress: physicalAddress.trim() || null,
        customOptOutText: customOptOutText.trim() || null,
      });
      toast.success('Throttling and compliance settings updated', 'Preferences Saved');
    } catch {
      toast.error('Failed to update settings', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-zinc-400">Loading delivery preferences...</div>;
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-8">
      {/* 1. Delivery Throttling */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-black text-zinc-900 tracking-tight">Global Delivery Throttling</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure account-wide sending ceilings to enforce deliverability safety across all rotating mailboxes combined.
          </p>
        </div>

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
          </div>
        </div>
      </div>

      {/* 2. CAN-SPAM Legal & Postal Compliance */}
      <div className="space-y-4 pt-6 border-t border-zinc-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-zinc-900 tracking-tight">CAN-SPAM & Legal Compliance</h3>
            <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-0.5 rounded-md">
              Legal Mandate
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Federal CAN-SPAM and CASL regulations mandate including a registered physical postal address in commercial emails.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Company / Entity Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Growth Inc."
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Registered Physical Postal Address
            </label>
            <input
              type="text"
              value={physicalAddress}
              onChange={(e) => setPhysicalAddress(e.target.value)}
              placeholder="100 Market St, Suite 400, San Francisco, CA 94105"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Custom Opt-Out Wording (Optional)
            </label>
            <input
              type="text"
              value={customOptOutText}
              onChange={(e) => setCustomOptOutText(e.target.value)}
              placeholder="Don't want to hear from us? Unsubscribe here"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              The platform automatically appends the working unsubscribe URL to this phrase.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-zinc-100">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
        >
          {saving ? 'Updating Settings...' : 'Save Compliance & Settings'}
        </button>
      </div>
    </div>
  );
};