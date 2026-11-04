import React from 'react';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney',
];

interface CampaignAutomationTabProps {
  canEdit: boolean;
  autoReplyEnabled: boolean;
  savingAutoReply: boolean;
  onToggleAutoReply: (checked: boolean) => void;
  sendHourUTC: number;
  savingSendHour: boolean;
  onSendHourChange: (hour: number) => void;
  onSaveSendHour: () => void;
  activeStartHour: number | '';
  activeEndHour: number | '';
  timezone: string;
  savingActiveHours: boolean;
  onStartHourChange: (val: number | '') => void;
  onEndHourChange: (val: number | '') => void;
  onTimezoneChange: (val: string) => void;
  onSaveActiveHours: () => void;
}

export const CampaignAutomationTab: React.FC<CampaignAutomationTabProps> = ({
  canEdit,
  autoReplyEnabled,
  savingAutoReply,
  onToggleAutoReply,
  sendHourUTC,
  savingSendHour,
  onSendHourChange,
  onSaveSendHour,
  activeStartHour,
  activeEndHour,
  timezone,
  savingActiveHours,
  onStartHourChange,
  onEndHourChange,
  onTimezoneChange,
  onSaveActiveHours,
}) => {
  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="p-3 bg-zinc-100 rounded-xl text-xs text-zinc-600 font-medium">
          You have view-only access — automation configurations are displayed in read-only mode.
        </div>
      )}

      {/* Autonomous AI Auto-Reply Toggle */}
      <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs flex items-center justify-between">
        <div className="max-w-xl">
          <h3 className="text-sm font-bold text-zinc-900">Autonomous AI Auto-Reply</h3>
          <p className="text-xs text-zinc-500 mt-1">
            When enabled, incoming replies from leads are analyzed and answered by AI immediately upon receipt.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={autoReplyEnabled}
            disabled={!canEdit || savingAutoReply}
            onChange={(e) => onToggleAutoReply(e.target.checked)}
          />
          <div className="w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:bg-blue-600 peer-disabled:opacity-50 transition-colors" />
          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      {/* Preferred Send Hour UTC */}
      <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Preferred Send Hour (UTC)</h3>
          <p className="text-xs text-zinc-500 mt-0.5">The queue worker prefers to schedule new mailbox capacity windows around this hour.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sendHourUTC}
            disabled={!canEdit}
            onChange={(e) => onSendHourChange(Number(e.target.value))}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 disabled:opacity-50"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC</option>
            ))}
          </select>
          {canEdit && (
            <button
              onClick={onSaveSendHour}
              disabled={savingSendHour}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
            >
              {savingSendHour ? 'Saving...' : 'Save Send Hour'}
            </button>
          )}
        </div>
      </div>

      {/* Active Sending Hours & Timezone */}
      <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Active Business Hours Window</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Emails are dispatched strictly during this window in the target prospect timezone. Leave hours blank to allow 24-hour dispatch.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Start Hour (0-23)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={activeStartHour}
              disabled={!canEdit}
              onChange={(e) => onStartHourChange(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold disabled:opacity-50"
              placeholder="e.g. 8"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">End Hour (0-23)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={activeEndHour}
              disabled={!canEdit}
              onChange={(e) => onEndHourChange(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold disabled:opacity-50"
              placeholder="e.g. 18"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Timezone</label>
            <select
              value={timezone}
              disabled={!canEdit}
              onChange={(e) => onTimezoneChange(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          {canEdit && (
            <button
              onClick={onSaveActiveHours}
              disabled={savingActiveHours}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
            >
              {savingActiveHours ? 'Saving...' : 'Save Window'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};