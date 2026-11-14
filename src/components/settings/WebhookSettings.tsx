import React, { useEffect, useState } from 'react';
import { webhookAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

interface WebhookSub {
  id: string;
  targetUrl: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  _count?: { deliveries: number };
}

export const WebhookSettings: React.FC = () => {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<WebhookSub[]>([]);
  const [loading, setLoading] = useState(true);

  const [targetUrl, setTargetUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['*']);
  const [creating, setCreating] = useState(false);

  const [inspectingSubId, setInspectingSubId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSubscriptions = async () => {
    try {
      const res = await webhookAPI.list();
      setSubscriptions(res.data || []);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load webhooks'), 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setCreating(true);
    try {
      await webhookAPI.create({
        targetUrl: targetUrl.trim(),
        events: selectedEvents,
      });
      toast.success('Webhook endpoint subscribed', 'Created');
      setTargetUrl('');
      setSelectedEvents(['*']);
      await fetchSubscriptions();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to create webhook endpoint'), 'Error');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await webhookAPI.delete(deleteTargetId);
      toast.info('Webhook endpoint removed', 'Deleted');
      setDeleteTargetId(null);
      await fetchSubscriptions();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not delete endpoint'), 'Error');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestPing = async (id: string) => {
    setPingingId(id);
    try {
      const res = await webhookAPI.test(id);
      const status = res.data?.delivery?.status;
      if (status === 'DELIVERED') {
        toast.success(`Ping returned HTTP ${res.data?.delivery?.statusCode} (${res.data?.delivery?.durationMs}ms)`, 'Ping Succeeded');
      } else {
        toast.warning(`Ping failed: ${res.data?.delivery?.error}`, 'Delivery Rejected');
      }
      if (inspectingSubId === id) {
        handleInspect(id);
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Test ping request failed'), 'Error');
    } finally {
      setPingingId(null);
    }
  };

  const handleInspect = async (id: string) => {
    setInspectingSubId(id);
    setLoadingDeliveries(true);
    try {
      const res = await webhookAPI.getDeliveries(id);
      setDeliveries(res.data || []);
    } catch {
      toast.error('Failed to load delivery logs', 'Error');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 card-midas rounded-2xl space-y-4">
        <div className="pb-3 border-b border-gold-500/35">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-royal-950 tracking-tight">Bi-Directional CRM &amp; Outbound Webhooks</h3>
            <span className="text-[10px] uppercase font-bold bg-thistle-100 text-royal-800 px-2 py-0.5 rounded-md border border-gold-500/35">
              HMAC-SHA256 Signed
            </span>
          </div>
          <p className="text-xs text-thistle-500 mt-0.5">
            Receive real-time signed HTTPS events whenever prospects reply, subscribe to Gongs, click CTAs, or trip deliverability alerts.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-3 p-4 bg-thistle-50/70 border border-gold-500/35 rounded-xl text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Target Endpoint URL (HTTPS)</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://your-crm.com/api/webhooks/midas or https://hooks.zapier.com/..."
              required
              className="w-full px-3 py-2 bg-white border border-gold-500/40 rounded-xl font-mono text-xs focus:outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Subscribed Events</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                ['*', 'All Events (*)'],
                ['lead.replied', 'Prospect Replied'],
                ['gong.subscribed', 'Gong Subscribed'],
                ['deliverability.circuit_tripped', 'Circuit Breaker Alert'],
                ['deal.booked', 'Deal Booked / CTA Clicked'],
              ].map(([ev, label]) => {
                const checked = selectedEvents.includes(ev);
                return (
                  <label key={ev} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gold-500/35 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (ev === '*') {
                          setSelectedEvents(['*']);
                        } else {
                          const next = selectedEvents.filter((x) => x !== '*');
                          if (e.target.checked) next.push(ev);
                          else next.splice(next.indexOf(ev), 1);
                          setSelectedEvents(next.length === 0 ? ['*'] : next);
                        }
                      }}
                      className="rounded border-thistle-400 text-royal-700 focus:ring-0"
                    />
                    <span className="font-medium text-royal-950 text-[11px]">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={creating || !targetUrl.trim()}
              className="px-4 py-2 btn-royal font-bold rounded-xl text-xs flex items-center gap-1.5"
            >
              <Icons.Plus className="text-gold-300" />
              <span>{creating ? 'Registering Endpoint...' : 'Add Webhook Endpoint'}</span>
            </button>
          </div>
        </form>

        <div className="space-y-3 pt-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-thistle-500">Loading subscriptions...</div>
          ) : subscriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-thistle-500">No outbound webhook endpoints configured yet.</div>
          ) : (
            subscriptions.map((sub) => (
              <div key={sub.id} className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <p className="font-mono font-bold text-royal-950 truncate max-w-lg">{sub.targetUrl}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-thistle-500">Signing Secret:</span>
                      <code className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-gold-500/35 text-royal-800 select-all">
                        {sub.secret}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleTestPing(sub.id)}
                      disabled={pingingId === sub.id}
                      className="px-3 py-1 bg-white border border-gold-500/35 hover:bg-thistle-100 text-royal-800 font-bold rounded-lg text-[11px] flex items-center gap-1"
                    >
                      <Icons.Bolt className="text-gold-600" />
                      <span>{pingingId === sub.id ? 'Pinging...' : 'Test Ping'}</span>
                    </button>
                    <button
                      onClick={() => handleInspect(sub.id)}
                      className="px-3 py-1 bg-white border border-gold-500/35 hover:bg-thistle-100 text-royal-700 font-bold rounded-lg text-[11px]"
                    >
                      Logs
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(sub.id)}
                      className="text-thistle-500 hover:text-rose-600 font-bold text-xs p-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 pt-2 border-t border-gold-500/25">
                  {sub.events.map((ev) => (
                    <span key={ev} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-thistle-100 text-royal-800 border border-gold-500/25">
                      {ev}
                    </span>
                  ))}
                </div>

                {inspectingSubId === sub.id && (
                  <div className="mt-3 p-3 bg-white border border-gold-500/35 rounded-xl space-y-2 text-[11px] animate-in fade-in duration-100">
                    <div className="flex items-center justify-between pb-1 border-b border-gold-500/25">
                      <span className="font-bold uppercase text-thistle-500 text-[10px]">Recent Delivery Attempts</span>
                      <button onClick={() => setInspectingSubId(null)} className="text-thistle-500 hover:text-royal-950 text-[10px] flex items-center gap-1">
                        <Icons.Close />
                        <span>Close</span>
                      </button>
                    </div>

                    {loadingDeliveries ? (
                      <p className="py-2 text-center text-thistle-500">Loading deliveries...</p>
                    ) : deliveries.length === 0 ? (
                      <p className="py-2 text-center text-thistle-500">No delivery attempts recorded yet.</p>
                    ) : (
                      deliveries.map((d) => (
                        <div key={d.id} className="p-2 rounded-lg bg-thistle-50 border border-gold-500/25 flex items-center justify-between font-mono text-[10px]">
                          <div>
                            <span className="font-bold text-royal-950">{d.event}</span>
                            <span className="text-thistle-500 ml-2">{new Date(d.createdAt).toLocaleTimeString()}</span>
                            {d.error && <p className="text-rose-600 mt-0.5">{d.error}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold px-1.5 py-0.2 rounded ${
                              d.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              HTTP {d.statusCode || 'ERR'}
                            </span>
                            <span className="text-thistle-500">{d.durationMs}ms</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Webhook Endpoint"
        description="Outbound CRM event deliveries to this target URL will stop immediately."
        confirmLabel="Remove Endpoint"
        loading={deleting}
      />
    </div>
  );
};