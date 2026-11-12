import React from 'react';
import { townCrierAPI } from '../../../services/api';
import { Pagination } from '../../Pagination';
import { useToast } from '../../../context/ToastContext';

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
    return <div className="py-24 text-center text-xs text-zinc-400">Loading subscribers...</div>;
  }

  if (recipients.length === 0) {
    return (
      <div className="py-20 text-center text-xs text-zinc-400 space-y-2 bg-white rounded-2xl border border-zinc-200">
        <p>No newsletter subscribers found.</p>
        <button
          onClick={onOpenAddRecipient}
          className="text-blue-600 font-bold hover:underline"
        >
          Add your first subscriber or import a CSV
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
      <table className="min-w-full divide-y divide-zinc-100 text-left text-xs">
        <thead className="bg-zinc-50/75 text-zinc-500 font-bold uppercase tracking-wider">
          <tr>
            <th className="py-3 px-4">Subscriber</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Tags</th>
            <th className="py-3 px-4">Source</th>
            <th className="py-3 px-4">Joined Date</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
          {recipients.map((r) => (
            <tr key={r.id} className="hover:bg-zinc-50/80">
              <td className="py-3 px-4">
                <p className="font-bold text-zinc-900">{r.name || 'Anonymous'}</p>
                <p className="text-[11px] text-zinc-400 font-mono">{r.email}</p>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  r.status === 'SUBSCRIBED' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {r.status}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {(r.tags || []).length === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    r.tags.map((t: string) => (
                      <span key={t} className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-700">
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="text-[10px] font-mono text-zinc-500 uppercase bg-zinc-100 px-1.5 py-0.5 rounded">
                  {r.source}
                </span>
              </td>
              <td className="py-3 px-4 text-zinc-400">{new Date(r.createdAt).toLocaleDateString()}</td>
              <td className="py-3 px-4 text-right">
                <button
                  onClick={() => handleDeleteRecipient(r.id)}
                  className="text-zinc-400 hover:text-rose-600 text-xs"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="p-4 border-t border-zinc-100">
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
};