import React, { useEffect, useState } from 'react';
import { domainAPI, getErrorMessage } from '../services/api';

interface DnsRecord {
  record_type: string;
  valid: string;
  name: string;
  value: string;
}

export const Domains: React.FC = () => {
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [senderLocalPart, setSenderLocalPart] = useState('hello');
  const [adding, setAdding] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [activeDomainDetails, setActiveDomainDetails] = useState<any | null>(null);

  const fetchDomains = async () => {
    try {
      setErrorBanner(null);
      const res = await domainAPI.getAll();
      setDomains(res.data);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to load domains');
      console.error(msg, err);
      setErrorBanner(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setAdding(true);
    setErrorBanner(null);

    try {
      await domainAPI.add(newDomain.trim(), senderLocalPart.trim() || 'hello');
      setNewDomain('');
      setSenderLocalPart('hello');
      await fetchDomains();
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to add sending domain');
      setErrorBanner(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      setErrorBanner(null);
      const res = await domainAPI.verify(id);
      if (res.data.status === 'active') {
        alert('Domain successfully verified and ready for sending!');
      } else {
        alert('DNS records not propagated yet. Please check your registrar and try again in a few minutes.');
      }
      await fetchDomains();
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Verification request failed');
      setErrorBanner(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain? This stops all sending via this domain.')) return;
    try {
      setErrorBanner(null);
      await domainAPI.delete(id);
      await fetchDomains();
      setActiveDomainDetails(null);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to delete domain');
      setErrorBanner(msg);
    }
  };

  const renderDnsTable = (title: string, records: DnsRecord[]) => (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Hostname</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Value</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.map((r, i) => (
              <tr key={i} className="bg-white">
                <td className="px-4 py-2 font-mono text-gray-600">{r.record_type}</td>
                <td className="px-4 py-2 font-mono text-gray-800 break-all">{r.name}</td>
                <td className="px-4 py-2 font-mono text-gray-800 break-all">{r.value}</td>
                <td className="px-4 py-2 text-center">
                  {r.valid === 'valid' ? '✅' : '❌'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Sending Domains</h1>

      {errorBanner && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-700 flex justify-between items-center">
          <span className="text-sm font-medium">{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">✕</button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Connect a New Subdomain</h2>
        <p className="text-sm text-gray-600 mb-4">We recommend using subdomains (e.g., outreach.yourdomain.com) to protect your root domain reputation.</p>
        <form onSubmit={handleAddDomain} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Domain / Subdomain</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g., mail.yourcompany.com"
              className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Sender Local-Part</label>
            <input
              type="text"
              value={senderLocalPart}
              onChange={(e) => setSenderLocalPart(e.target.value)}
              placeholder="e.g., sales, alex, hello"
              className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" disabled={adding} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
              {adding ? 'Connecting...' : 'Add Domain'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading domains...</div>
      ) : domains.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
          No sending domains configured yet. Add a domain above to start sending campaigns.
        </div>
      ) : (
        <div className="space-y-6">
          {domains.map(domain => {
            const isExpanded = activeDomainDetails?.id === domain.id;
            let records = { receiving: [], sending: [] };
            try {
              if (domain.dnsRecords) records = JSON.parse(domain.dnsRecords);
            } catch (e) {}

            return (
              <div key={domain.id} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{domain.domainName}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${domain.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {domain.status.toUpperCase()}
                      </span>
                      <span className="text-gray-500">Sender: <span className="font-mono">{domain.senderLocalPart || 'hello'}@{domain.domainName}</span></span>
                      <span className="text-gray-500">Warmup Day: {domain.warmupDay} (Limit: {domain.dailyLimit}/day)</span>
                      <span className="text-gray-500">Bounce Rate: {(domain.bounceRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {domain.status !== 'active' && (
                      <button onClick={() => handleVerify(domain.id)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium">
                        Verify DNS
                      </button>
                    )}
                    <button onClick={() => setActiveDomainDetails(isExpanded ? null : domain)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium">
                      {isExpanded ? 'Hide Records' : 'View DNS Records'}
                    </button>
                    <button onClick={() => handleDelete(domain.id)} className="px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm font-medium">
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 border-t bg-gray-50">
                    <p className="text-sm text-gray-600 mb-4">
                      Add the following records to your DNS registrar to verify ownership and activate high-reputation deliverability protocols.
                    </p>
                    {renderDnsTable('Sending Records (SPF, DKIM, Tracking)', records.sending || [])}
                    {renderDnsTable('Receiving Records (MX for inbound replies)', records.receiving || [])}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};