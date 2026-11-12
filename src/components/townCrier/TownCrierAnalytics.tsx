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
      <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Audience</span>
        <p className="text-xl font-black text-zinc-900 mt-1">{analytics.totalSubscribers}</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">Active subscribers</p>
      </div>
      <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">30-Day Growth</span>
        <p className="text-xl font-black text-emerald-600 mt-1">+{analytics.netGrowth30d}</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">New signups</p>
      </div>
      <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Sent</span>
        <p className="text-xl font-black text-blue-600 mt-1">{analytics.totalSent}</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">Delivered emails</p>
      </div>
      <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Broadcasts</span>
        <p className="text-xl font-black text-zinc-900 mt-1">{analytics.broadcastsCount}</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">Campaigns staged</p>
      </div>
      <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Churn Rate</span>
        <p className="text-xl font-black text-amber-600 mt-1">{analytics.churnRate}%</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.unsubscribedCount || 0} unsubscribed</p>
      </div>
    </div>
  );
};