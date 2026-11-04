import React from 'react';

interface CampaignSettingsTabProps {
  campaign: any;
  userSenders: any[];
  campaignSenderIds: Set<string>;
  canEdit: boolean;
  updatingSender: boolean;
  onToggleSender: (senderId: string, checked: boolean) => void;
  onEditStrategyClick: () => void;
}

export const CampaignSettingsTab: React.FC<CampaignSettingsTabProps> = ({
  campaign,
  userSenders,
  campaignSenderIds,
  canEdit,
  updatingSender,
  onToggleSender,
  onEditStrategyClick,
}) => {
  return (
    <div className="space-y-6">
      {/* Senders Assignment */}
      <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Assigned Mailboxes (Round-Robin)</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Select which active inboxes rotate this campaign's outbound dispatches.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {userSenders.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">No senders available. Connect a domain on the Domains page first.</p>
          ) : (
            userSenders.map((s) => (
              <label key={s.id} className="flex items-center gap-3 p-3.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={campaignSenderIds.has(s.id)}
                  onChange={(e) => onToggleSender(s.id, e.target.checked)}
                  disabled={!canEdit || updatingSender || s.status !== 'active'}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-0"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-900 font-mono">{s.localPart}@{s.domain?.domainName}</p>
                  <p className="text-[11px] text-zinc-400">Limit: {s.dailyLimit}/day · Sent today: {s.sentCountToday}</p>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Strategy Summary */}
      <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">SDR Strategy & Conversion Goal</h3>
            <p className="text-xs text-zinc-500 mt-0.5">The core objective guiding AI personalization and objection handling.</p>
          </div>
          {canEdit && (
            <button
              onClick={onEditStrategyClick}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-colors"
            >
              Edit Strategy
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="text-[10px] font-bold uppercase text-zinc-400">Primary Objective</span>
            <p className="font-semibold text-zinc-800 mt-0.5">{campaign.objective || 'Not specified'}</p>
          </div>
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="text-[10px] font-bold uppercase text-zinc-400">Target Conversion Tool</span>
            <p className="font-semibold text-zinc-800 mt-0.5">{campaign.targetTool || 'Not specified'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};