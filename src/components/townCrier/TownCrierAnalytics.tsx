import React from 'react';

interface TownCrierAnalyticsProps {
  analytics: {
    totalSubscribers: number;
    netGrowth30d: number;
    totalSent: number;
    broadcastsCount: number;
    churnRate: number;
    unsubscribedCount?: number;
  };
}

export const TownCrierAnalytics: React.FC<TownCrierAnalyticsProps> = ({ analytics }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="p-4 card-midas rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">Total Audience</span>
        <p className="text-xl font-black text-royal-950 mt-1">{analytics.totalSubscribers}</p>
        <p className="text-[10px] text-thistle-500 mt-0.5">Active subscribers</p>
      </div>
      <div className="p-4 card-midas rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">30-Day Growth</span>
        <p className="text-xl font-black text-emerald-700 mt-1">+{analytics.netGrowth30d}</p>
        <p className="text-[10px] text-thistle-500 mt-0.5">New signups</p>
      </div>
      <div className="p-4 card-midas rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">Total Sent</span>
        <p className="text-xl font-black text-royal-700 mt-1">{analytics.totalSent}</p>
        <p className="text-[10px] text-thistle-500 mt-0.5">Delivered emails</p>
      </div>
      <div className="p-4 card-midas rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">Broadcasts</span>
        <p className="text-xl font-black text-royal-950 mt-1">{analytics.broadcastsCount}</p>
        <p className="text-[10px] text-thistle-500 mt-0.5">Campaigns staged</p>
      </div>
      <div className="p-4 card-midas rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">Churn Rate</span>
        <p className="text-xl font-black text-amber-700 mt-1">{analytics.churnRate}%</p>
        <p className="text-[10px] text-thistle-500 mt-0.5">{analytics.unsubscribedCount || 0} unsubscribed</p>
      </div>
    </div>
  );
};