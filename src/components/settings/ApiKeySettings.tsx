import React, { useEffect, useState } from 'react';
import { apiKeyAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Sheet } from '../common/Sheet';
import { ConfirmDialog } from '../common/ConfirmDialog';
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

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['*']);
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<{ id: string; label: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

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

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await apiKeyAPI.revoke(revokeTarget.id);
      toast.warning(`API key "${revokeTarget.label}" revoked`, 'Key Revoked');
      setRevokeTarget(null);
      await fetchKeys();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to revoke API key'), 'Error');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 card-midas rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-gold-500/35">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-royal-950 tracking-tight">Workspace Developer API Keys</h3>
              <span className="text-[10px] uppercase font-bold bg-thistle-100 text-royal-800 px-2 py-0.5 rounded-md border border-gold-500/35">
                {apiKeys.length} / 15 Active Keys
              </span>
            </div>
            <p className="text-xs text-thistle-500 mt-0.5">
              Programmatic keys for CLI automation, external website forms, and CRM integrations. Supports granular wildcard scopes.
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            disabled={apiKeys.length >= 15}
            className="px-4 py-2 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.Key className="text-gold-300" />
            <span>Generate API Key</span>
          </button>
        </div>

        {revealedKey && (
          <div className="p-4 bg-amber-50 border border-gold-500/60 rounded-xl space-y-2 animate-in fade-in duration-150 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px]">Save Your Secret API Key</span>
              <button onClick={() => setRevealedKey(null)} className="text-amber-800 hover:text-amber-950 font-bold text-xs flex items-center gap-1">
                <Icons.Close />
                <span>Dismiss</span>
              </button>
            </div>
            <p className="text-amber-900 text-[11px]">
              Copy this key immediately. For security, it will <strong>never be displayed again</strong>.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={revealedKey}
                className="flex-1 px-3 py-1.5 bg-white border border-gold-500/50 rounded-lg text-xs font-mono font-bold text-royal-950 select-all"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(revealedKey);
                  toast.success('API Key copied to clipboard', 'Copied');
                }}
                className="px-3.5 py-1.5 btn-royal rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Icons.Copy className="text-gold-300" />
                <span>Copy Key</span>
              </button>
            </div>
          </div>
        )}

        <div className="border border-gold-500/40 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-xs text-thistle-500">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="py-12 text-center text-xs text-thistle-500 space-y-2">
              <p>No active API keys found for this workspace.</p>
              <button onClick={() => setIsCreateOpen(true)} className="text-royal-700 font-bold hover:underline">
                Generate your first key for programmatic access
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gold-500/25 text-left text-xs">
              <thead className="bg-thistle-100/75 text-royal-800 font-bold uppercase tracking-wider text-[10px] border-b border-gold-500/35">
                <tr>
                  <th className="py-3 px-4">Label</th>
                  <th className="py-3 px-4">Prefix</th>
                  <th className="py-3 px-4">Authorized Scopes</th>
                  <th className="py-3 px-4">Last Used</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-500/20 font-medium text-royal-950">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-thistle-50/80">
                    <td className="py-3 px-4 font-bold text-royal-950">{k.label}</td>
                    <td className="py-3 px-4 font-mono text-thistle-500">{k.keyPrefix}••••••••</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((scope) => (
                          <span key={scope} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-thistle-100 text-royal-800 border border-gold-500/30">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-thistle-500">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setRevokeTarget({ id: k.id, label: k.label })}
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

      <Sheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Provision Developer API Key"
        description="Create a secret key for CLI access, external webhooks, or website newsletter forms."
        width="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Key Label *</label>
            <input
              type="text"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              placeholder="e.g. Production Next.js App / Terminal CLI"
              required
              className="w-full px-3 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Assign Permission Scopes</label>
            <div className="space-y-2 p-3 bg-thistle-50 border border-gold-500/35 rounded-xl">
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
                      className="rounded border-thistle-400 text-royal-700 focus:ring-0"
                    />
                    <span className="font-semibold text-royal-950 text-[11px]">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-gold-500/35 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-thistle-500 font-bold hover:text-royal-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !keyLabel.trim()}
              className="px-5 py-2 btn-royal font-bold rounded-xl"
            >
              {creating ? 'Generating Key...' : 'Generate Secret Key'}
            </button>
          </div>
        </form>
      </Sheet>

      <ConfirmDialog
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        title={`Revoke API Key "${revokeTarget?.label}"`}
        description="Any external apps, embeds, or CLI scripts authenticating with this key will fail immediately."
        confirmLabel="Revoke Key"
        loading={revoking}
      />
    </div>
  );
};