import React, { useEffect, useState } from 'react';
import { domainAPI, senderAPI, getErrorMessage } from '../services/api';
import { Sheet } from '../components/common/Sheet';
import { useToast } from '../context/ToastContext';

interface Sender {
  id: string;
  localPart: string;
  displayName: string | null;
  status: string;
  dailyLimit: number;
  sentCountToday: number;
  warmupDay: number;
}

interface Domain {
  id: string;
  domainName: string;
  status: string;
  bounceRate: number;
  complaintRate: number;
  sendTestPassedAt: string | null;
  receivingConfirmedAt: string | null;
  receivingTestAddress: string | null;
  senders: Sender[];
}

export const Domains: React.FC = () => {
  const { toast } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Connect Drawer State (Hidden by default as requested)
  const [isConnectDrawerOpen, setIsConnectDrawerOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [mailgunKey, setMailgunKey] = useState('');
  const [region, setRegion] = useState<'us' | 'eu'>('us');
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Per-domain receiving-test state
  const [checkingReceiving, setCheckingReceiving] = useState<string | null>(null);
  const [receivingResult, setReceivingResult] = useState<Record<string, { confirmed: boolean; testAddress: string; testCode: string }>>({});

  // Per-domain add-sender form state
  const [senderFormOpenFor, setSenderFormOpenFor] = useState<string | null>(null);
  const [newSenderLocalPart, setNewSenderLocalPart] = useState('');
  const [newSenderDisplayName, setNewSenderDisplayName] = useState('');
  const [addingSender, setAddingSender] = useState(false);

  const fetchDomains = async () => {
    try {
      setErrorBanner(null);
      const res = await domainAPI.getAll();
      setDomains(res.data || []);
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Failed to load domains'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDomains(); }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim() || !mailgunKey.trim()) return;
    setConnecting(true);
    setErrorBanner(null);
    try {
      await domainAPI.connect(
        newDomain.trim(),
        mailgunKey.trim(),
        region,
        testRecipientEmail.trim() || undefined
      );
      toast.success(`Domain ${newDomain} connected and send-test verified!`, 'Verified');
      setNewDomain('');
      setMailgunKey('');
      setTestRecipientEmail('');
      setIsConnectDrawerOpen(false);
      await fetchDomains();
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Could not connect this domain');
      setErrorBanner(msg);
      toast.error(msg, 'Connection Rejected');
      await fetchDomains();
    } finally {
      setConnecting(false);
    }
  };

  const handleRetrySendTest = async (id: string) => {
    setErrorBanner(null);
    try {
      await domainAPI.retrySendTest(id, testRecipientEmail.trim() || undefined);
      toast.success('Live test send passed!', 'Verified');
      await fetchDomains();
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Send test failed again');
      setErrorBanner(msg);
      toast.error(msg, 'Send Test Failed');
    }
  };

  const handleResetReceivingTest = async (id: string) => {
    try {
      await domainAPI.resetReceivingTest(id);
      toast.info('New one-time verification code generated', 'Code Reset');
      await fetchDomains();
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Could not reset the receiving test'));
    }
  };

  const handleCheckReceiving = async (id: string) => {
    setCheckingReceiving(id);
    try {
      const res = await domainAPI.checkReceivingTest(id);
      setReceivingResult(prev => ({ ...prev, [id]: res.data }));
      if (res.data.confirmed) {
        toast.success('Inbound reply routing confirmed!', 'Domain Ready');
        await fetchDomains();
      } else {
        toast.info('Inbound test not yet detected. Ensure code was sent.', 'Pending');
      }
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Could not check receiving status'));
    } finally {
      setCheckingReceiving(null);
    }
  };

  const handleAddSender = async (domainId: string) => {
    if (!newSenderLocalPart.trim()) return;
    setAddingSender(true);
    try {
      await senderAPI.create(domainId, newSenderLocalPart.trim(), newSenderDisplayName.trim() || undefined);
      toast.success(`Sender ${newSenderLocalPart}@ added to rotation`, 'Created');
      setNewSenderLocalPart('');
      setNewSenderDisplayName('');
      setSenderFormOpenFor(null);
      await fetchDomains();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not create sender'), 'Error');
    } finally {
      setAddingSender(false);
    }
  };

  const handleDeleteSender = async (senderId: string) => {
    if (!confirm('Remove this mailbox sender? Campaigns using it will cease sending from this address.')) return;
    try {
      await senderAPI.delete(senderId);
      toast.info('Sender mailbox removed from rotation', 'Removed');
      await fetchDomains();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not remove sender'), 'Error');
    }
  };

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Delete this domain? All its senders and campaign linkages will be purged.')) return;
    try {
      await domainAPI.delete(id);
      toast.info('Domain and mailboxes deleted', 'Deleted');
      await fetchDomains();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not delete domain'), 'Error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 
        HEADER WITH TOP-LEFT "CONNECT NEW DOMAIN" ACTION:
        Connected domains show immediately without clutter.
      */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Sending Domains</h1>
            <button
              onClick={() => setIsConnectDrawerOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>+ Connect New Domain</span>
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Manage authenticated network sending domains, Mailgun credentials, and individual mailbox quotas.
          </p>
        </div>

        <div className="text-xs font-bold bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-xl border border-zinc-200">
          {domains.length} Domain{domains.length === 1 ? '' : 's'} Active
        </div>
      </div>

      {errorBanner && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-rose-700 flex justify-between items-center shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Error:</span>
            <span className="text-sm font-medium">{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* CONNECT DOMAIN SLIDE-OVER DRAWER */}
      <Sheet
        isOpen={isConnectDrawerOpen}
        onClose={() => setIsConnectDrawerOpen(false)}
        title="Connect Sending Domain"
        description="Verify an existing Mailgun domain with a live send test. Your API key is encrypted with AES-256-GCM."
        width="lg"
      >
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Domain Name</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g. outreach.company.com"
              required
              className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-[11px] text-zinc-400">Must match the domain name verified in your Mailgun account.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Mailgun Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as 'us' | 'eu')}
              className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none"
            >
              <option value="us">US Region (api.mailgun.net)</option>
              <option value="eu">EU Region (api.eu.mailgun.net)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Test Recipient (Optional)</label>
            <input
              type="email"
              value={testRecipientEmail}
              onChange={(e) => setTestRecipientEmail(e.target.value)}
              placeholder="your-email@gmail.com"
              className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-400">Where the live connectivity test will be sent. Defaults to your account email.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Mailgun Private API Key</label>
            <input
              type="password"
              value={mailgunKey}
              onChange={(e) => setMailgunKey(e.target.value)}
              placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
              className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-[11px] text-zinc-400">Primary Account or Sending Key from Mailgun Settings → API Security.</p>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsConnectDrawerOpen(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={connecting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors shadow-xs"
            >
              {connecting ? 'Running Live Send Test...' : 'Authenticate & Test'}
            </button>
          </div>
        </form>
      </Sheet>

      {/* CONNECTED DOMAINS OVERVIEW */}
      {loading ? (
        <div className="text-center py-20 text-zinc-400 text-xs font-medium">Loading domains and sender quotas...</div>
      ) : domains.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-zinc-900">No sending domains connected</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Connect an authenticated domain to enable autonomous sending and mailbox rotation.
          </p>
          <button
            onClick={() => setIsConnectDrawerOpen(true)}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
          >
            Connect First Domain
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {domains.map((domain) => {
            const receiving = receivingResult[domain.id];
            const isReceivingConfirmed = domain.receivingConfirmedAt || receiving?.confirmed;

            return (
              <div key={domain.id} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900 tracking-tight font-mono">{domain.domainName}</h3>
                    <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        domain.sendTestPassedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        Outbound Sending: {domain.sendTestPassedAt ? 'VERIFIED' : 'FAILED'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        isReceivingConfirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        Inbound Replies: {isReceivingConfirmed ? 'VERIFIED' : 'PENDING CODE'}
                      </span>
                      <span className="text-zinc-500 ml-2">Bounce rate: {(domain.bounceRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDomain(domain.id)}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors"
                  >
                    Delete Domain
                  </button>
                </div>

                {/* Send Test Retry Helper */}
                {!domain.sendTestPassedAt && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">The test send failed for this domain.</p>
                      <p className="opacity-90 mt-0.5">Ensure the domain matches Mailgun and the API key matches the configured region.</p>
                    </div>
                    <button
                      onClick={() => handleRetrySendTest(domain.id)}
                      className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors whitespace-nowrap"
                    >
                      Retry Test Send
                    </button>
                  </div>
                )}

                {/* Inbound Verification Box */}
                {domain.sendTestPassedAt && !isReceivingConfirmed && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-950 space-y-2">
                    <p className="font-bold">Step 2: Confirm Inbound Reply Routing</p>
                    <p className="text-zinc-600">
                      Send an email from an external inbox to{' '}
                      <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono font-bold">
                        {receiving?.testAddress || domain.receivingTestAddress}
                      </code>{' '}
                      with this code in the message:{' '}
                      <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono font-bold text-blue-700">
                        {receiving?.testCode || '(click Check Status to load)'}
                      </code>
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleCheckReceiving(domain.id)}
                        disabled={checkingReceiving === domain.id}
                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                      >
                        {checkingReceiving === domain.id ? 'Verifying...' : 'Check Status'}
                      </button>
                      <button
                        onClick={() => handleResetReceivingTest(domain.id)}
                        className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-50"
                      >
                        Regenerate Code
                      </button>
                    </div>
                  </div>
                )}

                {/* Senders (Mailbox Rotation) */}
                <div className="border-t border-zinc-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Sending Mailboxes (Senders)</h4>
                    {domain.sendTestPassedAt && (
                      <button
                        onClick={() => setSenderFormOpenFor(senderFormOpenFor === domain.id ? null : domain.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                      >
                        + Add Sender
                      </button>
                    )}
                  </div>

                  {senderFormOpenFor === domain.id && (
                    <div className="mb-4 p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-wrap items-end gap-3 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Local Address</label>
                        <div className="flex items-center">
                          <input
                            type="text"
                            value={newSenderLocalPart}
                            onChange={(e) => setNewSenderLocalPart(e.target.value)}
                            placeholder="sales"
                            className="w-28 px-2.5 py-1.5 border border-zinc-200 rounded-l-lg text-xs font-mono focus:outline-none"
                          />
                          <span className="px-2.5 py-1.5 border border-l-0 border-zinc-200 rounded-r-lg bg-zinc-100 text-[11px] text-zinc-500 font-mono">
                            @{domain.domainName}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Display Name (Optional)</label>
                        <input
                          type="text"
                          value={newSenderDisplayName}
                          onChange={(e) => setNewSenderDisplayName(e.target.value)}
                          placeholder="Alex Mercer"
                          className="px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleAddSender(domain.id)}
                        disabled={addingSender}
                        className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {addingSender ? 'Creating...' : 'Save Sender'}
                      </button>
                    </div>
                  )}

                  {domain.senders.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">
                      {domain.sendTestPassedAt ? 'No senders added yet. Add an address (e.g. sales@, alex@) to attach to campaigns.' : 'Pass the send test above before adding mailboxes.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {domain.senders.map((sender) => (
                        <div key={sender.id} className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200/60 rounded-xl text-xs">
                          <div>
                            <span className="font-mono font-bold text-zinc-900">{sender.localPart}@{domain.domainName}</span>
                            {sender.displayName && <span className="text-zinc-500 ml-2 font-medium">"{sender.displayName}"</span>}
                            <span className="text-zinc-400 ml-3 text-[11px]">
                              {sender.sentCountToday}/{sender.dailyLimit} sent today · warmup day {sender.warmupDay}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteSender(sender.id)}
                            className="text-zinc-400 hover:text-rose-600 text-xs font-medium transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};