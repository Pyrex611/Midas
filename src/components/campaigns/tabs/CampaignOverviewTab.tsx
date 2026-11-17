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
  const metricCards: Array<{
    cat: DrilldownCategory;
    label: string;
    value: string | number;
    sub: string;
    valueColor: string;
  }> = [
    { cat: 'ALL', label: 'Total Leads', value: analytics.totalLeads, sub: 'In sequence', valueColor: 'text-royal-950' },
    { cat: 'CONTACTED', label: 'Contacted', value: analytics.contactedCount, sub: 'Sent outreach', valueColor: 'text-royal-800' },
    { cat: 'OPENED', label: 'Human Opens', value: `${analytics.openRate}%`, sub: `${analytics.openedCount} unique`, valueColor: 'text-royal-700' },
    { cat: 'CLICKED', label: 'Clicked', value: `${analytics.clickRate}%`, sub: `${analytics.clickedCount} clicks`, valueColor: 'text-royal-600' },
    { cat: 'REPLIED', label: 'Replied', value: `${analytics.replyRate}%`, sub: `${analytics.replyCount} replies`, valueColor: 'text-emerald-700' },
    {
      cat: 'BOUNCED',
      label: 'Bounce Rate',
      value: `${analytics.bounceRate}%`,
      sub: `${analytics.bounceCount} bounces`,
      valueColor: analytics.bounceRate > 5 ? 'text-rose-600' : 'text-royal-950',
    },
    { cat: 'UNSUBSCRIBED', label: 'Opt-Outs', value: `${unsubscribeRate}%`, sub: `${analytics.unsubscribedCount} unsubs`, valueColor: 'text-amber-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {metricCards.map((m) => (
          <button
            key={m.cat}
            type="button"
            onClick={() => onSelectCategory(m.cat)}
            className="p-4 card-midas rounded-2xl cursor-pointer group text-left w-full"
            aria-label={`Inspect ${m.label}: ${m.value}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500 group-hover:text-royal-800">
                {m.label}
              </span>
              <Icons.ChevronLeft className="rotate-180 text-gold-500 text-xs" />
            </div>
            <p className={`text-xl font-black mt-1 ${m.valueColor}`}>{m.value}</p>
            <p className="text-[10px] text-thistle-500 mt-0.5">{m.sub}</p>
          </button>
        ))}
      </div>

      <div className="p-6 card-midas rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gold-500/35">
          <div>
            <h3 className="text-sm font-bold text-royal-950">Sequence Dispatch Controls</h3>
            <p className="text-xs text-thistle-500 mt-0.5">
              Emails dispatch automatically in paced batches of 5 per sweep to protect mailbox reputation.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReconcileQueue}
              disabled={isReconciling}
              className="px-3.5 py-1.5 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/35 text-royal-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Icons.Bolt className="text-gold-600" />
              <span>{isReconciling ? 'Syncing...' : 'Sync Unqueued Leads'}</span>
            </button>
            <button
              type="button"
              onClick={onDispatchNow}
              disabled={isDispatchingNow || campaign.queuedCount === 0}
              className="px-4 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Icons.Send className="text-gold-300" />
              <span>{isDispatchingNow ? 'Sending Batch...' : 'Dispatch Next Batch (5 Safe Sends)'}</span>
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