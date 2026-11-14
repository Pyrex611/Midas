import React from 'react';
import { townCrierAPI } from '../../../services/api';
import { Pagination } from '../../Pagination';
import { useToast } from '../../../context/ToastContext';
import { Icons } from '../../../lib/icons';

interface TownCrierAudienceTabProps {
  recipients: any[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  loading: boolean;
  onPageChange: (page: number) => void;
  onOpenAddRecipient: () => void;
  onRefresh: () => void;
}

export const TownCrierAudienceTab: React.FC<TownCrierAudienceTabProps> = ({
  recipients,
  pagination,
  loading,
  onPageChange,
  onOpenAddRecipient,
  onRefresh,
}) => {
  const { toast } = useToast();

  const handleDeleteRecipient = async (id: string) => {
    try {
      await townCrierAPI.deleteRecipient(id);
      toast.info('Subscriber removed', 'Removed');
      onRefresh();
    } catch {
      toast.error('Could not remove subscriber', 'Error');
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-xs text-thistle-500">Loading subscribers...</div>;
  }

  if (recipients.length === 0) {
    return (
      <div className="py-20 text-center text-xs text-thistle-500 space-y-2 card-midas rounded-2xl">
        <p>No newsletter subscribers found.</p>
        <button
          onClick={onOpenAddRecipient}
          className="text-royal-700 font-bold hover:underline"
        >
          Add your first subscriber or import a CSV
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gold-500/40 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gold-500/25 text-left text-xs">
          <thead className="bg-thistle-100/75 text-royal-800 font-bold uppercase tracking-wider border-b border-gold-500/35">
            <tr>
              <th className="py-3 px-4">Subscriber</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4">Joined Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-500/20 font-medium text-royal-950">
            {recipients.map((r) => (
              <tr key={r.id} className="hover:bg-thistle-50/80">
                <td className="py-3 px-4">
                  <p className="font-bold text-royal-950">{r.name || 'Anonymous'}</p>
                  <p className="text-[11px] text-thistle-500 font-mono">{r.email}</p>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    r.status === 'SUBSCRIBED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-thistle-100 text-thistle-500 border-gold-500/30'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {(r.tags || []).length === 0 ? (
                      <span className="text-thistle-500">—</span>
                    ) : (
                      r.tags.map((t: string) => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-thistle-100 text-royal-800 border border-gold-500/30">
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[10px] font-mono text-royal-800 uppercase bg-thistle-50 border border-gold-500/30 px-1.5 py-0.5 rounded">
                    {r.source}
                  </span>
                </td>
                <td className="py-3 px-4 text-thistle-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleDeleteRecipient(r.id)}
                    className="text-thistle-500 hover:text-rose-600 text-xs p-1"
                    title="Remove subscriber"
                  >
                    <Icons.Trash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gold-500/35">
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
};