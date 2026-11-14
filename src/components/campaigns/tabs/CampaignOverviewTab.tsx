import React from 'react';
import { Icons } from '../../../lib/icons';

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div
          onClick={() => onSelectCategory('ALL')}
          className="p-4 card-midas rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-royal-800">Total Leads</span>
            <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
          </div>
          <p className="text-xl font-black text-royal-950 mt-1">{analytics.totalLeads}</p>
          <p className="text-[10px] text-thistle-500 mt-0.5">In sequence</p>
        </div>

        <div
          onClick={() => onSelectCategory('CONTACTED')}
          className="p-4 card-midas rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-royal-800">Contacted</span>
            <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
          </div>
          <p className="text-xl font-black text-royal-800 mt-1">{analytics.contactedCount}</p>
          <p className="text-[10px] text-thistle-500 mt-0.5">Sent outreach</p>
        </div>

        <div
          onClick={() => onSelectCategory('OPENED')}
          className="p-4 card-midas rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-royal-800">Opened</span>
            <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
          </div>
          <p className="text-xl font-black text-royal-700 mt-1">{analytics.openRate}%</p>
          <p className="text-[10px] text-thistle-500 mt-0.5">{analytics.openedCount} unique</p>
        </div>

        <div
          onClick={() => onSelectCategory('CLICKED')}
          className="p-4 card-midas rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-royal-800">Clicked</span>
            <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
          </div>
          <p className="text-xl font-black text-royal-600 mt-1">{analytics.clickRate}%</p>
          <p className="text-[10px] text-thistle-500 mt-0.5">{analytics.clickedCount} clicks</p>
        </div>

        <div
          onClick={() => onSelectCategory('REPLIED')}
          className="p-4 card-midas rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-emerald-700">Replied</span>
            <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
          </div>
          <p className="text-xl font-black text-emerald-700 mt-1">{analytics.replyRate}%</p>
          <p className="text-[10px] text-thistle-500 mt-0.5">{analytics.replyCount} replies</p>
        </div>

        <div
          onClick={() => onSelectCategory('BOUNCED')}
          className="p-4 card-midas rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-rose-600">Bounce Rate</span>
            <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
          </div>
          <p className={`text-xl font-black mt-1 ${analytics.bounceRate > 5 ? 'text-rose-600' : 'text-royal-950'}`}>
            {analytics.bounceRate}%
          </p>
          <p className="text-[10px] text-thistle-500 mt-0.5">{analytics.bounceCount} bounces</p>
        </div>

        <div
          onClick={() => onSelectCategory('UNSUBSCRIBED')}
          className="p-4 card-midas rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-amber-700">Unsubscribe</span>
            <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
          </div>
          <p className="text-xl font-black text-amber-700 mt-1">{unsubscribeRate}%</p>
          <p className="text-[10px] text-thistle-500 mt-0.5">{analytics.unsubscribedCount} opt-outs</p>
        </div>
      </div>

      {/* Operational Status Card */}
      <div className="p-6 card-midas rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gold-500/35">
          <div>
            <h3 className="text-sm font-bold text-royal-950">Sequence Operational Status</h3>
            <p className="text-xs text-thistle-500 mt-0.5">Queue status, active mailboxes, and deliverability health.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onReconcileQueue}
              disabled={isReconciling}
              className="px-3.5 py-1.5 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/35 text-royal-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Icons.Bolt className="text-gold-600" />
              <span>{isReconciling ? 'Syncing...' : 'Reconcile Queue'}</span>
            </button>
            <button
              onClick={onDispatchNow}
              disabled={isDispatchingNow || campaign.queuedCount === 0}
              className="px-4 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Icons.Send className="text-gold-300" />
              <span>{isDispatchingNow ? 'Sending Batch...' : 'Send next batch (≤5)'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-thistle-50/70 rounded-xl border border-gold-500/35">
            <span className="text-[10px] font-bold uppercase text-thistle-500">Queue &amp; Status</span>
            <p className="font-bold text-royal-950 mt-1">{campaign.queuedCount || 0} Emails Waiting ({campaign.status})</p>
          </div>
          <div className="p-3 bg-thistle-50/70 rounded-xl border border-gold-500/35">
            <span className="text-[10px] font-bold uppercase text-thistle-500">Sending Mailboxes</span>
            <p className="font-bold text-royal-950 mt-1">{campaign.senderLinks?.length || 0} Assigned in Rotation</p>
          </div>
          <div className="p-3 bg-thistle-50/70 rounded-xl border border-gold-500/35">
            <span className="text-[10px] font-bold uppercase text-thistle-500">Deliverability Health</span>
            <p className="font-bold text-royal-950 mt-1">{analytics.bounceRate}% Bounce Rate ({analytics.unsubscribedCount} Unsubs)</p>
          </div>
        </div>
      </div>
    </div>
  );
};