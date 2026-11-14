import React from 'react';
import { Icons } from '../../lib/icons';

export interface HealthAlert {
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'RESUME' | 'ACTIVATE' | 'ASSIGN_SENDERS' | 'NAVIGATE_DOMAINS' | 'DISPATCH_NOW' | 'ADJUST_HOURS' | 'RECONCILE_QUEUE' | 'REPERSONALIZE';
}

interface CampaignHealthBannerProps {
  alerts: HealthAlert[];
  onAction: (actionType?: string) => void;
  isDispatchingNow: boolean;
  isReconciling: boolean;
  isRepersonalizing: boolean;
}

export const CampaignHealthBanner: React.FC<CampaignHealthBannerProps> = ({
  alerts,
  onAction,
  isDispatchingNow,
  isReconciling,
  isRepersonalizing,
}) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, idx) => {
        const isError = alert.severity === 'error';
        const isWarning = alert.severity === 'warning';

        return (
          <div
            key={idx}
            className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150 ${
              isError
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : isWarning
                ? 'bg-amber-50 border-gold-500/50 text-amber-950'
                : 'bg-white border-gold-500/40 text-royal-950'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isError
                    ? 'bg-rose-200 text-rose-800'
                    : isWarning
                    ? 'bg-gold-200 text-amber-900'
                    : 'bg-thistle-100 text-royal-700 border border-gold-500/35'
                }`}
              >
                {isError || isWarning ? <Icons.Warning /> : <Icons.Bolt className="text-gold-600" />}
              </div>
              <div>
                <p className="text-xs font-bold">{alert.title}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{alert.message}</p>
              </div>
            </div>

            {alert.actionLabel && (
              <button
                onClick={() => onAction(alert.actionType)}
                disabled={isDispatchingNow || isReconciling || isRepersonalizing}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap self-end sm:self-center ${
                  isError
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'btn-royal'
                }`}
              >
                {isDispatchingNow && alert.actionType === 'DISPATCH_NOW'
                  ? 'Sending Batch (≤5)...'
                  : isReconciling && alert.actionType === 'RECONCILE_QUEUE'
                  ? 'Queueing Leads...'
                  : isRepersonalizing && alert.actionType === 'REPERSONALIZE'
                  ? 'Refreshing from Reserves...'
                  : alert.actionLabel}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};