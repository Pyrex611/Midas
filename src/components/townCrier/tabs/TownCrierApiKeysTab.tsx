import React from 'react';
import { townCrierAPI } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

interface TownCrierApiKeysTabProps {
  apiKeys: any[];
  loading: boolean;
  onOpenCreateKey: () => void;
  onRefresh: () => void;
}

export const TownCrierApiKeysTab: React.FC<TownCrierApiKeysTabProps> = ({
  apiKeys,
  loading,
  onOpenCreateKey,
  onRefresh,
}) => {
  const { toast } = useToast();

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Revoke this API Key? Any public integration using it will immediately fail.')) return;
    try {
      await townCrierAPI.revokeApiKey(id);
      toast.warning('API Key revoked', 'Revoked');
      onRefresh();
    } catch {
      toast.error('Could not revoke API key', 'Error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-600 leading-relaxed">
        <span className="font-bold text-zinc-900">Developer Integration:</span> Authenticate external subscriber sign-up forms, webhooks, or blog integrations using your private API keys via:
        <code className="block mt-1 font-mono text-[11px] bg-white p-2 rounded border border-zinc-200 text-blue-700">
          POST /api/public/town-crier/subscribe <br />
          Headers: Authorization: Bearer tc_live_...
        </code>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-24 text-center text-xs text-zinc-400">Loading API keys...</div>
        ) : apiKeys.length === 0 ? (
          <div className="py-20 text-center text-xs text-zinc-400 space-y-2">
            <p>No active API keys found.</p>
            <button onClick={onOpenCreateKey} className="text-blue-600 font-bold hover:underline">
              Generate your first key for public ingestion
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-zinc-100 text-left text-xs">
            <thead className="bg-zinc-50/75 text-zinc-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Label</th>
                <th className="py-3 px-4">Key Prefix</th>
                <th className="py-3 px-4">Scopes</th>
                <th className="py-3 px-4">Last Used</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {apiKeys.map((k) => (
                <tr key={k.id} className="hover:bg-zinc-50/80">
                  <td className="py-3 px-4 font-bold text-zinc-900">{k.label}</td>
                  <td className="py-3 px-4 font-mono text-zinc-600">{k.keyPrefix}••••••••</td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                      {k.scopes?.join(', ') || 'town_crier:write'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRevokeApiKey(k.id)}
                      className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};