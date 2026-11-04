import React from 'react';

type DrilldownCategory = 'ALL' | 'CONTACTED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'BOUNCED' | 'UNSUBSCRIBED';

interface CampaignOverviewTabProps {
  analytics: {
    totalLeads: number;
    contactedCount: number;
    queuedCount: number;
    sentCount: number;
    openRate: number;
    openedCount: number;
    clickRate: number;
    clickedCount: number;
    replyRate: number;
    replyCount: number;
    bounceRate: number;
    bounceCount: number;
    unsubscribedCount: number;
  };
  unsubscribeRate: number;
  campaign: any;
  onSelectCategory: (category: DrilldownCategory) => void;
  onReconcileQueue: () => void;
  onDispatchNow: () => void;
  isReconciling: boolean;
  isDispatchingNow: boolean;
}

export const CampaignOverviewTab: React.FC<CampaignOverviewTabProps> = ({
  analytics,
  unsubscribeRate,
  campaign,
  onSelectCategory,
  onReconcileQueue,
  onDispatchNow,
  isReconciling,
  isDispatchingNow,
}) => {
  return (
    <div className="space-y-6">
      {/* 7 Interactive Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1: Total Leads */}
        <div
          onClick={() => onSelectCategory('ALL')}
          className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Total Leads</span>
            <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
          </div>
          <p className="text-xl font-black text-zinc-900 mt-1">{analytics.totalLeads}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">In sequence</p>
        </div>

        {/* Card 2: Contacted */}
        <div
          onClick={() => onSelectCategory('CONTACTED')}
          className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Contacted</span>
            <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
          </div>
          <p className="text-xl font-black text-zinc-800 mt-1">{analytics.contactedCount}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Sent outreach</p>
        </div>

        {/* Card 3: Opened */}
        <div
          onClick={() => onSelectCategory('OPENED')}
          className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Opened</span>
            <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
          </div>
          <p className="text-xl font-black text-blue-600 mt-1">{analytics.openRate}%</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.openedCount} unique</p>
        </div>

        {/* Card 4: Clicked */}
        <div
          onClick={() => onSelectCategory('CLICKED')}
          className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Clicked</span>
            <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
          </div>
          <p className="text-xl font-black text-purple-600 mt-1">{analytics.clickRate}%</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.clickedCount} clicks</p>
        </div>

        {/* Card 5: Replied */}
        <div
          onClick={() => onSelectCategory('REPLIED')}
          className="p-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-600">Replied</span>
            <span className="text-zinc-300 group-hover:text-blue-500 text-xs">↗</span>
          </div>
          <p className="text-xl font-black text-emerald-600 mt-1">{analytics.replyRate}%</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.replyCount} replies</p>
        </div>

        {/* Card 6: Bounced */}
        <div
          onClick={() => onSelectCategory('BOUNCED')}
          className="p-4 bg-white border border-zinc-200 hover:border-rose-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-rose-600">Bounce Rate</span>
            <span className="text-zinc-300 group-hover:text-rose-500 text-xs">↗</span>
          </div>
          <p className={`text-xl font-black mt-1 ${analytics.bounceRate > 5 ? 'text-rose-600' : 'text-zinc-900'}`}>
            {analytics.bounceRate}%
          </p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.bounceCount} bounces</p>
        </div>

        {/* Card 7: Unsubscribed */}
        <div
          onClick={() => onSelectCategory('UNSUBSCRIBED')}
          className="p-4 bg-white border border-zinc-200 hover:border-amber-500 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-amber-600">Unsubscribe</span>
            <span className="text-zinc-300 group-hover:text-amber-500 text-xs">↗</span>
          </div>
          <p className="text-xl font-black text-amber-600 mt-1">{unsubscribeRate}%</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.unsubscribedCount} opt-outs</p>
        </div>
      </div>

      {/* Operational Status Card */}
      <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Sequence Operational Status</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Queue status, active mailboxes, and deliverability health.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onReconcileQueue}
              disabled={isReconciling}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-colors"
            >
              {isReconciling ? 'Syncing...' : '⚡ Reconcile Queue'}
            </button>
            <button
              onClick={onDispatchNow}
              disabled={isDispatchingNow || campaign.queuedCount === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
            >
              {isDispatchingNow ? 'Sending Batch...' : 'Send next batch (≤5)'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-zinc-100">
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="text-[10px] font-bold uppercase text-zinc-400">Queue & Status</span>
            <p className="font-bold text-zinc-800 mt-1">{campaign.queuedCount || 0} Emails Waiting ({campaign.status})</p>
          </div>
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="text-[10px] font-bold uppercase text-zinc-400">Sending Mailboxes</span>
            <p className="font-bold text-zinc-800 mt-1">{campaign.senderLinks?.length || 0} Assigned in Rotation</p>
          </div>
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="text-[10px] font-bold uppercase text-zinc-400">Deliverability Health</span>
            <p className="font-bold text-zinc-800 mt-1">{analytics.bounceRate}% Bounce Rate ({analytics.unsubscribedCount} Unsubs)</p>
          </div>
        </div>
      </div>
    </div>
  );
};