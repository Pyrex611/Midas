import React, { useState } from 'react';
import { townCrierAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { Icons } from '../../../lib/icons';

interface TownCrierBroadcastsTabProps {
  broadcasts: any[];
  loading: boolean;
  onOpenComposer: () => void;
  onRefresh: () => void;
}

export const TownCrierBroadcastsTab: React.FC<TownCrierBroadcastsTabProps> = ({
  broadcasts,
  loading,
  onOpenComposer,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [queueingId, setQueueingId] = useState<string | null>(null);

  const handleQueueBroadcast = async (id: string) => {
    setQueueingId(id);
    try {
      const res = await townCrierAPI.queueBroadcast(id);
      toast.success(res.data.message, 'Queued for Send');
      onRefresh();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to queue broadcast'), 'Queue Error');
    } finally {
      setQueueingId(null);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('Delete this broadcast draft?')) return;
    try {
      await townCrierAPI.deleteBroadcast(id);
      toast.info('Broadcast deleted', 'Deleted');
      onRefresh();
    } catch {
      toast.error('Could not delete broadcast', 'Error');
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-xs text-zinc-400">Loading broadcast history...</div>;
  }

  if (broadcasts.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center">
          <Icons.TownCrier className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-zinc-900">No broadcasts created yet</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Compose your first newsletter broadcast. Outbound delivery is automatically throttled through bounded queue sweeps.
        </p>
        <button
          onClick={onOpenComposer}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
        >
          Create First Broadcast
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {broadcasts.map((b) => {
        const total = b.metrics?.total || 0;
        const sent = b.metrics?.sent || 0;
        const percent = total > 0 ? Math.round((sent / total) * 100) : 0;

        return (
          <div key={b.id} className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">{b.subject}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    b.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700'
                      : b.status === 'SENDING' || b.status === 'QUEUED'
                      ? 'bg-blue-50 text-blue-700 animate-pulse'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {b.status}
                  </span>
                  {b.tagFilter && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-100 text-zinc-600">
                      Tag: {b.tagFilter}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">Created on {new Date(b.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                {b.status === 'DRAFT' && (
                  <button
                    onClick={() => handleQueueBroadcast(b.id)}
                    disabled={queueingId === b.id}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
                  >
                    {queueingId === b.id ? 'Queueing...' : 'Queue for Send (Bounded)'}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteBroadcast(b.id)}
                  className="text-zinc-400 hover:text-rose-600 text-xs p-1"
                >
                  Delete
                </button>
              </div>
            </div>

            <p className="text-xs text-zinc-600 line-clamp-2">{b.body}</p>

            {total > 0 && (
              <div className="space-y-1 pt-2 border-t border-zinc-100 text-[11px]">
                <div className="flex justify-between text-zinc-500 font-medium">
                  <span>Progress: {sent} of {total} sent ({percent}%)</span>
                  <span>{b.metrics?.failed || 0} failed</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${percent}%` }}
                    className={`h-full transition-all duration-300 ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};