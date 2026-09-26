import React, { useEffect, useState } from 'react';
import { domainAPI, senderAPI, getErrorMessage } from '../services/api';

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
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // --- Connect form ---
  const [newDomain, setNewDomain] = useState('');
  const [mailgunKey, setMailgunKey] = useState('');
  const [region, setRegion] = useState<'us' | 'eu'>('us');
  const [connecting, setConnecting] = useState(false);

  // --- Per-domain receiving-test state ---
  const [checkingReceiving, setCheckingReceiving] = useState<string | null>(null);
  const [receivingResult, setReceivingResult] = useState<Record<string, { confirmed: boolean; testAddress: string; testCode: string }>>({});

  // --- Per-domain add-sender form ---
  const [senderFormOpenFor, setSenderFormOpenFor] = useState<string | null>(null);
  const [newSenderLocalPart, setNewSenderLocalPart] = useState('');
  const [newSenderDisplayName, setNewSenderDisplayName] = useState('');
  const [addingSender, setAddingSender] = useState(false);

  const fetchDomains = async () => {
    try {
      setErrorBanner(null);
      const res = await domainAPI.getAll();
      setDomains(res.data);
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
      await domainAPI.connect(newDomain.trim(), mailgunKey.trim(), region);
      setNewDomain('');
      setMailgunKey('');
      await fetchDomains();
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Could not connect this domain — see details below'));
    } finally {
      setConnecting(false);
    }
  };

  const handleRetrySendTest = async (id: string) => {
    setErrorBanner(null);
    try {
      await domainAPI.retrySendTest(id);
      await fetchDomains();
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Send test failed again'));
    }
  };

  const handleResetReceivingTest = async (id: string) => {
    try {
      await domainAPI.resetReceivingTest(id);
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
      if (res.data.confirmed) await fetchDomains();
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
      setNewSenderLocalPart('');
      setNewSenderDisplayName('');
      setSenderFormOpenFor(null);
      await fetchDomains();
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Could not create sender'));
    } finally {
      setAddingSender(false);
    }
  };

  const handleDeleteSender = async (senderId: string) => {
    if (!confirm('Remove this sender? Campaigns using it will stop sending from this address.')) return;
    try {
      await senderAPI.delete(senderId);
      await fetchDomains();
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Could not remove sender'));
    }
  };

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Delete this domain? All its senders and campaign links go with it.')) return;
    try {
      await domainAPI.delete(id);
      await fetchDomains();
    } catch (err: any) {
      setErrorBanner(getErrorMessage(err, 'Could not delete domain'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Sending Domains</h1>
      <p className="text-sm text-gray-500 mb-8">
        Connect a domain you already send from with Mailgun. We prove it works with one real test
        email, then a one-time code confirms replies reach you — no dependency on Mailgun's own
        domain-creation API, which some plans (including free/trial accounts) restrict.
      </p>

      {errorBanner && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-700 flex justify-between items-center">
          <span className="text-sm font-medium">{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">✕</button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Connect a domain</h2>
        <form onSubmit={handleConnect} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Domain</label>
            <input
              type="text" value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
              placeholder="pyrexxai.com" required
              className="w-full px-4 py-2 border rounded-md text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Region</label>
            <select value={region} onChange={(e) => setRegion(e.target.value as 'us' | 'eu')} className="w-full px-4 py-2 border rounded-md text-sm">
              <option value="us">US (default)</option>
              <option value="eu">EU</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mailgun API Key</label>
            <input
              type="password" value={mailgunKey} onChange={(e) => setMailgunKey(e.target.value)}
              placeholder="The same key you'd use with: curl --user &quot;api:KEY&quot; https://api.mailgun.net/v3/..."
              required
              className="w-full px-4 py-2 border rounded-md text-sm font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Stored encrypted. Never shown again or returned by the API after this.</p>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button type="submit" disabled={connecting} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
              {connecting ? 'Sending test email...' : 'Connect & Run Test Send'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading domains...</div>
      ) : domains.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
          No domains connected yet. Connect one above to start sending campaigns.
        </div>
      ) : (
        <div className="space-y-6">
          {domains.map(domain => {
            const receiving = receivingResult[domain.id];
            const isReceivingConfirmed = domain.receivingConfirmedAt || receiving?.confirmed;

            return (
              <div key={domain.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{domain.domainName}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${domain.sendTestPassedAt ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        Sending: {domain.sendTestPassedAt ? 'Confirmed' : 'Not confirmed'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isReceivingConfirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        Replies: {isReceivingConfirmed ? 'Confirmed' : 'Not confirmed yet'}
                      </span>
                      <span className="text-gray-500">Bounce rate: {(domain.bounceRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteDomain(domain.id)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100">
                    Delete
                  </button>
                </div>

                {!domain.sendTestPassedAt && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-md text-xs text-red-700 flex items-center justify-between">
                    <span>The test send failed for this domain — fix the key/domain and retry.</span>
                    <button onClick={() => handleRetrySendTest(domain.id)} className="ml-3 px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">
                      Retry Test Send
                    </button>
                  </div>
                )}

                {domain.sendTestPassedAt && !isReceivingConfirmed && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-900">
                    <p className="font-semibold mb-1">Confirm replies reach you</p>
                    <p className="text-xs mb-3">
                      From any email account (Gmail, Outlook, etc.), send an email to{' '}
                      <code className="bg-white px-1.5 py-0.5 rounded border">{receiving?.testAddress || domain.receivingTestAddress}</code>{' '}
                      with this code somewhere in the subject or body:{' '}
                      <code className="bg-white px-1.5 py-0.5 rounded border font-bold">{receiving?.testCode || '(click Check Now to reveal)'}</code>
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCheckReceiving(domain.id)}
                        disabled={checkingReceiving === domain.id}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {checkingReceiving === domain.id ? 'Checking...' : 'Check Now'}
                      </button>
                      <button onClick={() => handleResetReceivingTest(domain.id)} className="px-3 py-1.5 bg-white border rounded text-xs font-medium hover:bg-gray-50">
                        Get a new code
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-blue-700">
                      Midas sets up the inbound Route for this domain automatically once the send test
                      passes. Nothing arriving after a few minutes? Some Mailgun plans restrict Routes API
                      access — check Mailgun dashboard → Receiving → Routes and add one manually if it's
                      missing, forwarding to this domain's Midas webhook.
                    </p>
                  </div>
                )}

                {/* Senders */}
                <div className="mt-5 border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-700">Senders (mailboxes)</h4>
                    {domain.sendTestPassedAt && (
                      <button
                        onClick={() => setSenderFormOpenFor(senderFormOpenFor === domain.id ? null : domain.id)}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        + Add Sender
                      </button>
                    )}
                  </div>

                  {senderFormOpenFor === domain.id && (
                    <div className="mb-3 p-3 bg-gray-50 border rounded-md flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Address</label>
                        <div className="flex items-center">
                          <input
                            type="text" value={newSenderLocalPart} onChange={(e) => setNewSenderLocalPart(e.target.value)}
                            placeholder="sales" className="w-28 px-2 py-1.5 border rounded-l-md text-sm font-mono"
                          />
                          <span className="px-2 py-1.5 border border-l-0 rounded-r-md bg-white text-xs text-gray-500 font-mono">@{domain.domainName}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Display name (optional)</label>
                        <input
                          type="text" value={newSenderDisplayName} onChange={(e) => setNewSenderDisplayName(e.target.value)}
                          placeholder="Alex from Acme" className="px-2 py-1.5 border rounded-md text-sm"
                        />
                      </div>
                      <button
                        onClick={() => handleAddSender(domain.id)}
                        disabled={addingSender}
                        className="px-3 py-1.5 bg-gray-800 text-white rounded text-xs font-medium hover:bg-gray-900 disabled:opacity-50"
                      >
                        {addingSender ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  )}

                  {domain.senders.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      {domain.sendTestPassedAt ? 'No senders yet — add one to start using this domain in a campaign.' : 'Pass the send test above before adding senders.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {domain.senders.map(sender => (
                        <div key={sender.id} className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-md text-sm">
                          <div>
                            <span className="font-mono font-semibold text-gray-800">{sender.localPart}@{domain.domainName}</span>
                            {sender.displayName && <span className="text-gray-500 ml-2">"{sender.displayName}"</span>}
                            <span className="text-xs text-gray-400 ml-3">
                              {sender.sentCountToday}/{sender.dailyLimit} sent today · warmup day {sender.warmupDay}
                            </span>
                          </div>
                          <button onClick={() => handleDeleteSender(sender.id)} className="text-xs text-red-600 hover:underline">Remove</button>
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