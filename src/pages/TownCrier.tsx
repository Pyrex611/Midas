import React, { useEffect, useState, useRef } from 'react';
import { townCrierAPI, getErrorMessage } from '../services/api';
import { Sheet } from '../components/common/Sheet';
import { Pagination } from '../components/Pagination';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

type Tab = 'broadcasts' | 'audience' | 'apiKeys';

export const TownCrier: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('broadcasts');

  // Analytics Metrics State
  const [analytics, setAnalytics] = useState<any>({
    totalSubscribers: 0,
    netGrowth30d: 0,
    churnRate: 0,
    broadcastsCount: 0,
    totalSent: 0,
  });

  // Broadcasts State
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTagFilter, setBroadcastTagFilter] = useState('');
  const [savingBroadcast, setSavingBroadcast] = useState(false);
  const [queueingId, setQueueingId] = useState<string | null>(null);

  // Audience State
  const [recipients, setRecipients] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('newsletter');
  const [submittingRecipient, setSubmittingRecipient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // API Keys & Embed State
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [isEmbedDrawerOpen, setIsEmbedDrawerOpen] = useState(false);
  const [embedFrameworkTab, setEmbedFrameworkTab] = useState<'universal' | 'nextjs' | 'node' | 'vite'>('universal');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const res = await townCrierAPI.getAnalytics();
      setAnalytics(res.data);
    } catch {}
  };

  const fetchBroadcasts = async () => {
    try {
      const res = await townCrierAPI.getBroadcasts();
      setBroadcasts(res.data || []);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load broadcasts'), 'Network Error');
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const fetchRecipients = async (page = pagination.page) => {
    setLoadingAudience(true);
    try {
      const res = await townCrierAPI.getRecipients(page, pagination.pageSize);
      setRecipients(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load audience'), 'Network Error');
    } finally {
      setLoadingAudience(false);
    }
  };

  const fetchApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await townCrierAPI.getApiKeys();
      setApiKeys(res.data || []);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load API keys'), 'Network Error');
    } finally {
      setLoadingKeys(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    if (activeTab === 'broadcasts') fetchBroadcasts();
    if (activeTab === 'audience') fetchRecipients(1);
    if (activeTab === 'apiKeys') fetchApiKeys();
  }, [activeTab]);

  const copyToClipboard = async (code: string, label: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopiedSnippet(label);
      toast.success(`${label} copied to clipboard!`, 'Copied');
      setTimeout(() => setCopiedSnippet(null), 2500);
    } catch {
      toast.error('Could not copy code to clipboard', 'Error');
    }
  };

  const handleExportContacts = async (format: 'json' | 'csv') => {
    try {
      toast.info(`Preparing ${format.toUpperCase()} export...`, 'Exporting');
      const res = await townCrierAPI.exportRecipients(format, 'all');

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `subscribers-export-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const link = document.createElement('a');
        link.href = dataStr;
        link.setAttribute('download', `subscribers-dump-${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      toast.success('Contacts exported successfully', 'Export Complete');
    } catch {
      toast.error('Failed to export contacts', 'Export Error');
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastSubject.trim() || !broadcastBody.trim()) return;

    setSavingBroadcast(true);
    try {
      await townCrierAPI.createBroadcast({
        subject: broadcastSubject.trim(),
        body: broadcastBody.trim(),
        tagFilter: broadcastTagFilter.trim() || undefined,
      });
      toast.success('Broadcast created as Draft', 'Saved');
      setBroadcastSubject('');
      setBroadcastBody('');
      setBroadcastTagFilter('');
      setIsComposerOpen(false);
      await fetchBroadcasts();
      await fetchAnalytics();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not create broadcast'), 'Error');
    } finally {
      setSavingBroadcast(false);
    }
  };

  const handleQueueBroadcast = async (id: string) => {
    setQueueingId(id);
    try {
      const res = await townCrierAPI.queueBroadcast(id);
      toast.success(res.data.message, 'Queued for Send');
      await fetchBroadcasts();
      await fetchAnalytics();
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
      await fetchBroadcasts();
    } catch {
      toast.error('Could not delete broadcast', 'Error');
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setSubmittingRecipient(true);
    try {
      const tagsArray = newTags.split(/[,;]/).map(t => t.trim()).filter(Boolean);
      await townCrierAPI.addRecipient(newEmail.trim(), newName.trim() || undefined, tagsArray);
      toast.success(`Subscribed ${newEmail.trim()}`, 'Subscriber Added');
      setNewEmail('');
      setNewName('');
      setNewTags('newsletter');
      setIsAddRecipientOpen(false);
      await fetchRecipients(1);
      await fetchAnalytics();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to add subscriber'), 'Error');
    } finally {
      setSubmittingRecipient(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await townCrierAPI.importRecipients(file);
      toast.success(`Imported ${res.data.importedCount} subscriber(s)`, 'CSV Import Complete');
      await fetchRecipients(1);
      await fetchAnalytics();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to import CSV'), 'Import Error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    try {
      await townCrierAPI.deleteRecipient(id);
      toast.info('Subscriber removed', 'Removed');
      await fetchRecipients(pagination.page);
      await fetchAnalytics();
    } catch {
      toast.error('Could not remove subscriber', 'Error');
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim()) return;

    setCreatingKey(true);
    try {
      const res = await townCrierAPI.createApiKey(keyLabel.trim());
      setRevealedKey(res.data.plaintextKey);
      setKeyLabel('');
      setIsCreateKeyOpen(false);
      toast.success('API Key generated successfully', 'Key Provisioned');
      await fetchApiKeys();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not generate API Key'), 'Error');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Revoke this API Key? Any public integration using it will immediately fail.')) return;
    try {
      await townCrierAPI.revokeApiKey(id);
      toast.warning('API Key revoked', 'Revoked');
      await fetchApiKeys();
    } catch {
      toast.error('Could not revoke API key', 'Error');
    }
  };

  // Code snippets for copy actions
  const universalSnippet = `<!-- 1. Include Universal Widget Script -->
<script src="${window.location.origin}/api/public/town-crier/widget.js" async></script>

<!-- 2. Drop-in HTML Form (Automatically captured) -->
<form data-town-crier-key="tc_live_YOUR_API_KEY">
  <input type="email" name="email" placeholder="Enter your email" required />
  <input type="text" name="name" placeholder="Your name (optional)" />
  <button type="submit">Subscribe</button>
  <div class="tc-success-message" style="display:none; color: green; margin-top: 8px;">
    Thanks for subscribing!
  </div>
</form>`;

  const nextJsSnippet = `// app/api/newsletter/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { email, name } = await req.json();

  const res = await fetch('${window.location.origin}/api/public/town-crier/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${process.env.TOWN_CRIER_API_KEY}\` // tc_live_...
    },
    body: JSON.stringify({ email, name, tags: ['nextjs_signup'] })
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ success: true, subscriber: data.subscriber });
}`;

  const nodeJsSnippet = `import { TownCrierClient } from './lib/townCrierClient';

const client = new TownCrierClient({
  apiKey: process.env.TOWN_CRIER_API_KEY, // tc_live_...
  baseUrl: '${window.location.origin}'
});

// Single Subscription (Auto-enrolls in cold sequence if campaignId is passed)
await client.subscribe({
  email: 'prospect@acme.com',
  name: 'Alex Mercer',
  tags: ['enterprise', 'lead_magnet'],
  campaignId: 'optional_campaign_id'
});

// Bulk Ingestion
await client.bulkSubscribe([
  { email: 'user1@acme.com', name: 'User 1' },
  { email: 'user2@acme.com', name: 'User 2' }
]);`;

  const viteReactSnippet = `import React, { useState } from 'react';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch('${window.location.origin}/api/public/town-crier/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer tc_live_YOUR_API_KEY'
        },
        body: JSON.stringify({ email, tags: ['vite_react'] })
      });

      if (!res.ok) throw new Error('Failed to subscribe');
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Joining...' : 'Subscribe'}
      </button>
      {status === 'success' && <p>Subscribed successfully!</p>}
    </form>
  );
}`;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Town Crier</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60">
              Newsletter Engine
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Universal list marketing & newsletter engine. Fully integrated with Next.js, Node.js, and Vite.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEmbedDrawerOpen(true)}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Icons.Code className="w-4 h-4 text-blue-600" />
            <span>Integrate SDK & Forms</span>
          </button>

          <div className="relative group">
            <button className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
              <Icons.Download className="w-4 h-4 text-zinc-500" />
              <span>Export Contacts ▾</span>
            </button>
            <div className="absolute right-0 mt-1 w-36 bg-white border border-zinc-200 rounded-xl shadow-lg p-1 hidden group-hover:block z-30">
              <button
                onClick={() => handleExportContacts('csv')}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 rounded-lg"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExportContacts('json')}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 rounded-lg"
              >
                Export as JSON
              </button>
            </div>
          </div>

          {activeTab === 'broadcasts' && (
            <button
              onClick={() => setIsComposerOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Icons.Plus className="w-4 h-4" />
              <span>New Broadcast</span>
            </button>
          )}

          {activeTab === 'audience' && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleCsvImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors"
              >
                Import CSV
              </button>
              <button
                onClick={() => setIsAddRecipientOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                + Add Subscriber
              </button>
            </>
          )}

          {activeTab === 'apiKeys' && (
            <button
              onClick={() => setIsCreateKeyOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Icons.Key className="w-4 h-4" />
              <span>Generate Key</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Metrics Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Audience</span>
          <p className="text-xl font-black text-zinc-900 mt-1">{analytics.totalSubscribers}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Active subscribers</p>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">30-Day Growth</span>
          <p className="text-xl font-black text-emerald-600 mt-1">+{analytics.netGrowth30d}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">New signups</p>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Sent</span>
          <p className="text-xl font-black text-blue-600 mt-1">{analytics.totalSent}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Delivered emails</p>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Broadcasts</span>
          <p className="text-xl font-black text-zinc-900 mt-1">{analytics.broadcastsCount}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Campaigns staged</p>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Churn Rate</span>
          <p className="text-xl font-black text-amber-600 mt-1">{analytics.churnRate}%</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{analytics.unsubscribedCount} unsubscribed</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="flex space-x-8">
          {[
            ['broadcasts', 'Broadcasts'],
            ['audience', `Audience (${pagination.total || 0})`],
            ['apiKeys', `Public API Keys (${apiKeys.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as Tab)}
              className={`py-3 px-1 border-b-2 text-xs font-bold transition-colors ${
                activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Plaintext Key Reveal Card */}
      {revealedKey && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Your New Town Crier API Key</span>
            <button onClick={() => setRevealedKey(null)} className="text-amber-700 hover:text-amber-950 font-bold text-xs">✕ Dismiss</button>
          </div>
          <p className="text-xs text-amber-800">
            Copy and store this API key safely now. For security, it will <strong>never be shown again</strong>.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={revealedKey}
              className="flex-1 px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-zinc-900 select-all"
            />
            <button
              onClick={() => copyToClipboard(revealedKey, 'API Key')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              {copiedSnippet === 'API Key' ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Icons.Code className="w-4 h-4" />
                  <span>Copy Key</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: BROADCASTS */}
      {activeTab === 'broadcasts' && (
        <div className="space-y-4">
          {loadingBroadcasts ? (
            <div className="py-24 text-center text-xs text-zinc-400">Loading broadcast history...</div>
          ) : broadcasts.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center">
                <Icons.TownCrier className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900">No broadcasts created yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Compose your first newsletter broadcast. Outbound delivery is automatically throttled through bounded queue sweeps.
              </p>
              <button
                onClick={() => setIsComposerOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
              >
                Create First Broadcast
              </button>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* TAB 2: AUDIENCE / SUBSCRIBERS */}
      {activeTab === 'audience' && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          {loadingAudience ? (
            <div className="py-24 text-center text-xs text-zinc-400">Loading subscribers...</div>
          ) : recipients.length === 0 ? (
            <div className="py-20 text-center text-xs text-zinc-400 space-y-2">
              <p>No newsletter subscribers found.</p>
              <button
                onClick={() => setIsAddRecipientOpen(true)}
                className="text-blue-600 font-bold hover:underline"
              >
                Add your first subscriber or import a CSV
              </button>
            </div>
          ) : (
            <div>
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
                  onPageChange={(p) => fetchRecipients(p)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: API KEYS */}
      {activeTab === 'apiKeys' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-600 leading-relaxed">
            <span className="font-bold text-zinc-900">Developer Integration:</span> Authenticate external subscriber sign-up forms, webhooks, or blog integrations using your private API keys via:
            <code className="block mt-1 font-mono text-[11px] bg-white p-2 rounded border border-zinc-200 text-blue-700">
              POST /api/public/town-crier/subscribe <br />
              Headers: Authorization: Bearer tc_live_...
            </code>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            {loadingKeys ? (
              <div className="py-24 text-center text-xs text-zinc-400">Loading API keys...</div>
            ) : apiKeys.length === 0 ? (
              <div className="py-20 text-center text-xs text-zinc-400 space-y-2">
                <p>No active API keys found.</p>
                <button onClick={() => setIsCreateKeyOpen(true)} className="text-blue-600 font-bold hover:underline">
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
      )}

      {/* Broadcast Composer Sheet */}
      <Sheet
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        title="Compose Broadcast Newsletter"
        description="Write and stage a broadcast message. Strictly drained through the bounded ≤5/tick queue engine."
        width="xl"
      >
        <form onSubmit={handleCreateBroadcast} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Broadcast Subject Line</label>
            <input
              type="text"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              placeholder="e.g. November Updates: What we shipped this month"
              required
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Target Tag Filter (Optional)</label>
            <input
              type="text"
              value={broadcastTagFilter}
              onChange={(e) => setBroadcastTagFilter(e.target.value)}
              placeholder="Leave blank to send to all active subscribers, or enter e.g. webflow"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Newsletter Body (Supports Spintax & Personalization)</label>
            <textarea
              rows={12}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Write your broadcast content here..."
              required
              className="w-full p-3.5 border border-zinc-200 rounded-xl text-xs font-sans focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBroadcast}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
            >
              {savingBroadcast ? 'Saving Draft...' : 'Save Broadcast Draft'}
            </button>
          </div>
        </form>
      </Sheet>

      {/* Add Single Subscriber Sheet */}
      <Sheet
        isOpen={isAddRecipientOpen}
        onClose={() => setIsAddRecipientOpen(false)}
        title="Add Newsletter Subscriber"
        description="Add a single verified subscriber to your Town Crier audience."
        width="md"
      >
        <form onSubmit={handleAddRecipient} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Subscriber Email *</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="subscriber@domain.com"
              required
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Subscriber Name (Optional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="newsletter, web-signup"
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddRecipientOpen(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingRecipient}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs"
            >
              {submittingRecipient ? 'Adding...' : 'Subscribe'}
            </button>
          </div>
        </form>
      </Sheet>

      {/* Create API Key Sheet */}
      <Sheet
        isOpen={isCreateKeyOpen}
        onClose={() => setIsCreateKeyOpen(false)}
        title="Provision Town Crier API Key"
        description="Generate a secret key to ingest newsletter subscribers from external websites or blogs."
        width="md"
      >
        <form onSubmit={handleCreateApiKey} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Key Label</label>
            <input
              type="text"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              placeholder="e.g. Website Blog Footer Form"
              required
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateKeyOpen(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingKey}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs"
            >
              {creatingKey ? 'Generating...' : 'Generate Key'}
            </button>
          </div>
        </form>
      </Sheet>

      {/* 
        MULTI-ENVIRONMENT SDK & EMBED SNIPPET DRAWER
        1-Click Copy Optimized across Universal Script, Next.js, Node.js, and Vite/React.
      */}
      <Sheet
        isOpen={isEmbedDrawerOpen}
        onClose={() => setIsEmbedDrawerOpen(false)}
        title="Universal Town Crier Integration Suite"
        description="1-Click code snippets to integrate newsletter subscriber ingestion into any Next.js, Node.js, Vite, or web platform."
        width="2xl"
      >
        <div className="space-y-5 text-xs">
          {/* Framework Switcher Tabs */}
          <div className="flex border-b border-zinc-200 gap-2 pb-2 overflow-x-auto">
            {[
              ['universal', '1. Drop-In <script> (Universal)'],
              ['nextjs', '2. Next.js (App Router)'],
              ['node', '3. Node.js Backend'],
              ['vite', '4. Vite / React Hook'],
            ].map(([tabKey, label]) => (
              <button
                key={tabKey}
                onClick={() => setEmbedFrameworkTab(tabKey as any)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  embedFrameworkTab === tabKey
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TAB 1: UNIVERSAL DROP-IN EMBED (Webflow, WordPress, HTML) */}
          {embedFrameworkTab === 'universal' && (
            <div className="space-y-3">
              <p className="text-zinc-600">
                Drop this script tag into any website header or footer. Add <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold text-amber-800">data-town-crier-key="YOUR_KEY"</code> to any form to make it ingest subscribers automatically:
              </p>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                  <span className="text-[11px] font-mono font-bold text-zinc-400">index.html (Drop-in Embed)</span>
                  <button
                    onClick={() => copyToClipboard(universalSnippet, 'Universal HTML Embed')}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                  >
                    {copiedSnippet === 'Universal HTML Embed' ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        <span>1-Click Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {universalSnippet}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: NEXT.JS APP ROUTER */}
          {embedFrameworkTab === 'nextjs' && (
            <div className="space-y-3">
              <p className="text-zinc-600">
                In Next.js, securely proxy subscriber signups through an API Route Handler to keep your API key secret on the server:
              </p>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                  <span className="text-[11px] font-mono font-bold text-zinc-400">app/api/newsletter/route.ts</span>
                  <button
                    onClick={() => copyToClipboard(nextJsSnippet, 'Next.js API Handler')}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                  >
                    {copiedSnippet === 'Next.js API Handler' ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        <span>1-Click Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {nextJsSnippet}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: NODE.JS BACKEND CLIENT */}
          {embedFrameworkTab === 'node' && (
            <div className="space-y-3">
              <p className="text-zinc-600">
                Use native Node.js 18+ <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">fetch</code> or import the isomorphic <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">TownCrierClient</code>:
              </p>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                  <span className="text-[11px] font-mono font-bold text-zinc-400">server/newsletter.ts (Node SDK)</span>
                  <button
                    onClick={() => copyToClipboard(nodeJsSnippet, 'Node.js SDK Snippet')}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                  >
                    {copiedSnippet === 'Node.js SDK Snippet' ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        <span>1-Click Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {nodeJsSnippet}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: VITE / REACT HOOK */}
          {embedFrameworkTab === 'vite' && (
            <div className="space-y-3">
              <p className="text-zinc-600">
                In Vite or pure React SPAs, utilize a simple async submission handler or React component:
              </p>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                  <span className="text-[11px] font-mono font-bold text-zinc-400">src/components/NewsletterSignup.tsx</span>
                  <button
                    onClick={() => copyToClipboard(viteReactSnippet, 'React / Vite Snippet')}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                  >
                    {copiedSnippet === 'React / Vite Snippet' ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        <span>1-Click Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {viteReactSnippet}
                </pre>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setIsEmbedDrawerOpen(false)}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              Done Reading Guide
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};