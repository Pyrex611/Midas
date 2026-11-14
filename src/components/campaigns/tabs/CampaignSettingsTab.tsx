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
      <div className="p-6 card-midas rounded-2xl space-y-4">
        <div className="pb-3 border-b border-gold-500/35">
          <h3 className="text-sm font-bold text-royal-950">Assigned Mailboxes (Round-Robin)</h3>
          <p className="text-xs text-thistle-500 mt-0.5">Select which active inboxes rotate this campaign's outbound dispatches.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {userSenders.length === 0 ? (
            <p className="text-xs text-thistle-500 italic">No senders available. Connect a domain on the Domains page first.</p>
          ) : (
            userSenders.map((s) => (
              <label key={s.id} className="flex items-center gap-3 p-3.5 border border-gold-500/35 bg-thistle-50/50 rounded-xl hover:bg-thistle-100/70 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={campaignSenderIds.has(s.id)}
                  onChange={(e) => onToggleSender(s.id, e.target.checked)}
                  disabled={!canEdit || updatingSender || s.status !== 'active'}
                  className="rounded border-thistle-400 text-royal-700 focus:ring-0"
                />
                <div>
                  <p className="text-xs font-bold text-royal-950 font-mono">{s.localPart}@{s.domain?.domainName}</p>
                  <p className="text-[11px] text-thistle-500">Limit: {s.dailyLimit}/day · Sent today: {s.sentCountToday}</p>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="p-6 card-midas rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gold-500/35">
          <div>
            <h3 className="text-sm font-bold text-royal-950">SDR Strategy &amp; Conversion Goal</h3>
            <p className="text-xs text-thistle-500 mt-0.5">The core objective guiding AI personalization and objection handling.</p>
          </div>
          {canEdit && (
            <button
              onClick={onEditStrategyClick}
              className="px-3.5 py-1.5 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/35 text-royal-800 rounded-xl text-xs font-bold transition-colors"
            >
              Edit Strategy
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-thistle-50/70 rounded-xl border border-gold-500/30">
            <span className="text-[10px] font-bold uppercase text-thistle-500">Primary Objective</span>
            <p className="font-semibold text-royal-950 mt-0.5">{campaign.objective || 'Not specified'}</p>
          </div>
          <div className="p-3 bg-thistle-50/70 rounded-xl border border-gold-500/30">
            <span className="text-[10px] font-bold uppercase text-thistle-500">Target Conversion Tool</span>
            <p className="font-semibold text-royal-950 mt-0.5">{campaign.targetTool || 'Not specified'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};