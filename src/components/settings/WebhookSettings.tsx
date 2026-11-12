import React, { useEffect, useState } from 'react';
import { webhookAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

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

  // New Subscription Form State
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['*']);
  const [creating, setCreating] = useState(false);

  // Deliveries Inspection State
  const [inspectingSubId, setInspectingSubId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this webhook endpoint? Event deliveries will cease.')) return;
    try {
      await webhookAPI.delete(id);
      toast.info('Webhook endpoint removed', 'Deleted');
      await fetchSubscriptions();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not delete endpoint'), 'Error');
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
      <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-zinc-900 tracking-tight">Bi-Directional CRM & Outbound Webhooks</h3>
            <span className="text-[10px] uppercase font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200/60">
              Feature Rec A
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Receive real-time signed HTTPS events whenever prospects reply, subscribe to Gongs, or trigger deliverability alerts.
          </p>
        </div>

        {/* Add Webhook Form */}
        <form onSubmit={handleCreate} className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Target Endpoint URL (HTTPS)</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://your-crm.com/api/webhooks/midas or https://hooks.zapier.com/..."
              required
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl font-mono text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Subscribed Events</label>
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
                  <label key={ev} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200 rounded-lg cursor-pointer">
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
                      className="rounded border-zinc-300 text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-zinc-800 text-[11px]">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={creating || !targetUrl.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 transition-colors shadow-xs"
            >
              {creating ? 'Registering Endpoint...' : '+ Add Webhook Endpoint'}
            </button>
          </div>
        </form>

        {/* Existing Endpoints List */}
        <div className="space-y-3 pt-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-zinc-400">Loading subscriptions...</div>
          ) : subscriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">No outbound webhook endpoints configured yet.</div>
          ) : (
            subscriptions.map((sub) => (
              <div key={sub.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <p className="font-mono font-bold text-zinc-900 truncate max-w-lg">{sub.targetUrl}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-zinc-400">Signing Secret:</span>
                      <code className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-700 select-all">
                        {sub.secret}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleTestPing(sub.id)}
                      disabled={pingingId === sub.id}
                      className="px-3 py-1 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold rounded-lg text-[11px] shadow-2xs"
                    >
                      {pingingId === sub.id ? 'Pinging...' : '⚡ Test Ping'}
                    </button>
                    <button
                      onClick={() => handleInspect(sub.id)}
                      className="px-3 py-1 bg-white border border-zinc-200 hover:bg-zinc-100 text-blue-600 font-bold rounded-lg text-[11px] shadow-2xs"
                    >
                      Logs
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="text-zinc-400 hover:text-rose-600 font-bold text-xs p-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-200/60">
                  {sub.events.map((ev) => (
                    <span key={ev} className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-700">
                      {ev}
                    </span>
                  ))}
                </div>

                {/* Live Delivery Inspection Log */}
                {inspectingSubId === sub.id && (
                  <div className="mt-3 p-3 bg-white border border-zinc-200 rounded-xl space-y-2 text-[11px] animate-in fade-in duration-100">
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
                      <span className="font-bold uppercase text-zinc-500 text-[10px]">Recent Delivery Attempts</span>
                      <button onClick={() => setInspectingSubId(null)} className="text-zinc-400 hover:text-zinc-600 text-[10px]">✕ Close</button>
                    </div>

                    {loadingDeliveries ? (
                      <p className="py-2 text-center text-zinc-400">Loading deliveries...</p>
                    ) : deliveries.length === 0 ? (
                      <p className="py-2 text-center text-zinc-400">No delivery attempts recorded yet.</p>
                    ) : (
                      deliveries.map((d) => (
                        <div key={d.id} className="p-2 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-between font-mono text-[10px]">
                          <div>
                            <span className="font-bold text-zinc-800">{d.event}</span>
                            <span className="text-zinc-400 ml-2">{new Date(d.createdAt).toLocaleTimeString()}</span>
                            {d.error && <p className="text-rose-600 mt-0.5">{d.error}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold px-1.5 py-0.2 rounded ${
                              d.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              HTTP {d.statusCode || 'ERR'}
                            </span>
                            <span className="text-zinc-400">{d.durationMs}ms</span>
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
    </div>
  );
};