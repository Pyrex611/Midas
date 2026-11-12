import React, { useEffect, useState } from 'react';
import { apiKeyAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Sheet } from '../common/Sheet';
import { Icons } from '../../lib/icons';

interface ApiKeyItem {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export const ApiKeySettings: React.FC = () => {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Key creation state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['*']);
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await apiKeyAPI.list();
      setApiKeys(res.data || []);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load API keys'), 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim()) return;

    setCreating(true);
    try {
      const res = await apiKeyAPI.create(keyLabel.trim(), selectedScopes);
      setRevealedKey(res.data.plaintextKey);
      setKeyLabel('');
      setSelectedScopes(['*']);
      setIsCreateOpen(false);
      toast.success('Workspace API Key provisioned', 'Key Created');
      await fetchKeys();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not provision API key'), 'Error');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, label: string) => {
    if (!confirm(`Revoke API key "${label}"? Any external services using it will immediately fail.`)) return;
    try {
      await apiKeyAPI.revoke(id);
      toast.warning(`API key "${label}" revoked`, 'Key Revoked');
      await fetchKeys();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to revoke API key'), 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-zinc-900 tracking-tight">Workspace Developer API Keys</h3>
              <span className="text-[10px] uppercase font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md border border-zinc-200">
                {apiKeys.length} / 15 Active Keys
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Programmatic keys for CLI automation, external website forms, and CRM integrations. Supports granular wildcard scopes.
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            disabled={apiKeys.length >= 15}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icons.Key className="w-4 h-4" />
            <span>+ Generate API Key</span>
          </button>
        </div>

        {/* Revealed Key Card */}
        {revealedKey && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 animate-in fade-in duration-150 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px]">Save Your Secret API Key</span>
              <button onClick={() => setRevealedKey(null)} className="text-amber-800 hover:text-amber-950 font-bold text-xs">✕ Dismiss</button>
            </div>
            <p className="text-amber-900 text-[11px]">
              Copy this key immediately. For security, it will <strong>never be displayed again</strong>.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={revealedKey}
                className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-zinc-900 select-all"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(revealedKey);
                  toast.success('API Key copied to clipboard', 'Copied');
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
              >
                Copy Key
              </button>
            </div>
          </div>
        )}

        {/* Existing Keys Table */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400 space-y-2">
              <p>No active API keys found for this workspace.</p>
              <button onClick={() => setIsCreateOpen(true)} className="text-blue-600 font-bold hover:underline">
                Generate your first key for programmatic access
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-zinc-100 text-left text-xs">
              <thead className="bg-zinc-50/80 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Label</th>
                  <th className="py-3 px-4">Prefix</th>
                  <th className="py-3 px-4">Authorized Scopes</th>
                  <th className="py-3 px-4">Last Used</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-zinc-50/80">
                    <td className="py-3 px-4 font-bold text-zinc-900">{k.label}</td>
                    <td className="py-3 px-4 font-mono text-zinc-600">{k.keyPrefix}••••••••</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((scope) => (
                          <span key={scope} className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200/50">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRevoke(k.id, k.label)}
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

      {/* Provision Key Sheet */}
      <Sheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Provision Developer API Key"
        description="Create a secret key for CLI access, external webhooks, or website newsletter forms."
        width="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Key Label *</label>
            <input
              type="text"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              placeholder="e.g. Production Next.js App / Terminal CLI"
              required
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Assign Permission Scopes</label>
            <div className="space-y-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
              {[
                ['*', 'Super Admin (* - Full Access)'],
                ['campaigns:*', 'Outreach Campaigns (Read/Write/Dispatch)'],
                ['leads:*', 'Leads Management (Read/Upload/Delete)'],
                ['town_crier:*', 'Town Crier Newsletters & Gongs'],
                ['analytics:*', 'Analytics & Reporting Telemetry'],
              ].map(([scope, label]) => {
                const checked = selectedScopes.includes(scope);
                return (
                  <label key={scope} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (scope === '*') {
                          setSelectedScopes(['*']);
                        } else {
                          const next = selectedScopes.filter((x) => x !== '*');
                          if (e.target.checked) next.push(scope);
                          else next.splice(next.indexOf(scope), 1);
                          setSelectedScopes(next.length === 0 ? ['*'] : next);
                        }
                      }}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-0"
                    />
                    <span className="font-semibold text-zinc-800 text-[11px]">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-zinc-600 font-bold hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !keyLabel.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors shadow-xs"
            >
              {creating ? 'Generating Key...' : 'Generate Secret Key'}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};