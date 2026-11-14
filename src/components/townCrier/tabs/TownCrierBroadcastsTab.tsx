import React, { useState } from 'react';
import { townCrierAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { ConfirmDialog } from '../../common/ConfirmDialog';
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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await townCrierAPI.deleteBroadcast(deleteTargetId);
      toast.info('Broadcast deleted', 'Deleted');
      setDeleteTargetId(null);
      onRefresh();
    } catch {
      toast.error('Could not delete broadcast', 'Error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-xs text-thistle-500">Loading broadcast history...</div>;
  }

  if (broadcasts.length === 0) {
    return (
      <div className="card-midas rounded-2xl p-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-thistle-100 text-royal-700 border border-gold-500/40 mx-auto flex items-center justify-center">
          <Icons.TownCrier className="text-xl text-gold-600" />
        </div>
        <h3 className="text-base font-bold text-royal-950">No broadcasts created yet</h3>
        <p className="text-xs text-thistle-500 max-w-sm mx-auto">
          Compose your first newsletter broadcast. Outbound delivery is automatically throttled through bounded queue sweeps.
        </p>
        <button
          onClick={onOpenComposer}
          className="px-4 py-2 btn-royal rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Icons.Plus className="text-gold-300" />
          <span>Create First Broadcast</span>
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
          <div key={b.id} className="p-5 card-midas rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-royal-950">{b.subject}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    b.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : b.status === 'SENDING' || b.status === 'QUEUED'
                      ? 'bg-royal-700 text-gold-300 border-gold-400/50 animate-pulse'
                      : 'bg-thistle-100 text-royal-800 border-gold-500/35'
                  }`}>
                    {b.status}
                  </span>
                  {b.gong && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-thistle-100 text-royal-700 border border-gold-500/30">
                      Gong: /{b.gong.slug}
                    </span>
                  )}
                  {b.tagFilter && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-thistle-50 text-royal-800 border border-gold-500/30">
                      Tag: {b.tagFilter}
                    </span>
                  )}
                  {b.templateStyle && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-white text-thistle-500 border border-gold-500/25">
                      {b.templateStyle}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-thistle-500 mt-0.5">Created on {new Date(b.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                {b.status === 'DRAFT' && (
                  <button
                    onClick={() => handleQueueBroadcast(b.id)}
                    disabled={queueingId === b.id}
                    className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <Icons.Send className="text-gold-300" />
                    <span>{queueingId === b.id ? 'Queueing...' : 'Queue for Send (Bounded)'}</span>
                  </button>
                )}
                <button
                  onClick={() => setDeleteTargetId(b.id)}
                  className="text-thistle-500 hover:text-rose-600 text-xs p-1.5 flex items-center gap-1"
                  title="Delete broadcast"
                >
                  <Icons.Trash />
                </button>
              </div>
            </div>

            <p className="text-xs text-royal-950/75 line-clamp-2">{b.body}</p>

            {total > 0 && (
              <div className="space-y-1 pt-2 border-t border-gold-500/30 text-[11px]">
                <div className="flex justify-between text-thistle-500 font-medium">
                  <span>Progress: {sent} of {total} sent ({percent}%)</span>
                  <span>{b.metrics?.failed || 0} failed</span>
                </div>
                <div className="w-full h-1.5 bg-thistle-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${percent}%` }}
                    className={`h-full transition-all duration-300 ${percent === 100 ? 'bg-emerald-500' : 'bg-royal-700'}`}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Broadcast"
        description="Are you sure you want to delete this broadcast draft and its queued items?"
        confirmLabel="Delete Broadcast"
        loading={deleting}
      />
    </div>
  );
};