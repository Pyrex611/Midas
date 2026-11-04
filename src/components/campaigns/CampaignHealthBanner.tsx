import React from 'react';

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
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : isWarning
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-blue-50 border-blue-200 text-blue-950'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                  isError ? 'bg-rose-200 text-rose-800' : isWarning ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'
                }`}
              >
                {isError ? '!' : isWarning ? '⏸' : 'i'}
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
                    : isWarning
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
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