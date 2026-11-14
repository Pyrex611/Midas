import React, { useState } from 'react';
import { Sheet } from '../../common/Sheet';
import { domainAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

interface ConnectDomainDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onErrorBanner: (msg: string) => void;
}

export const ConnectDomainDrawer: React.FC<ConnectDomainDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onErrorBanner,
}) => {
  const { toast } = useToast();
  const [newDomain, setNewDomain] = useState('');
  const [mailgunKey, setMailgunKey] = useState('');
  const [region, setRegion] = useState<'us' | 'eu'>('us');
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim() || !mailgunKey.trim()) return;

    setConnecting(true);
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
      onClose();
      onSuccess();
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Could not connect this domain');
      onErrorBanner(msg);
      toast.error(msg, 'Connection Rejected');
      onSuccess();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Sending Domain"
      description="Verify an existing Mailgun domain with a live send test. Your API key is encrypted with AES-256-GCM."
      width="lg"
    >
      <form onSubmit={handleConnect} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Domain Name</label>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. outreach.company.com"
            required
            className="w-full px-4 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm font-mono focus:outline-none focus:border-gold-500"
          />
          <p className="mt-1 text-[11px] text-thistle-500">Must match the domain name verified in your Mailgun account.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Mailgun Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as 'us' | 'eu')}
            className="w-full px-4 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm focus:outline-none focus:border-gold-500"
          >
            <option value="us">US Region (api.mailgun.net)</option>
            <option value="eu">EU Region (api.eu.mailgun.net)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Test Recipient (Optional)</label>
          <input
            type="email"
            value={testRecipientEmail}
            onChange={(e) => setTestRecipientEmail(e.target.value)}
            placeholder="your-email@gmail.com"
            className="w-full px-4 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm focus:outline-none focus:border-gold-500"
          />
          <p className="mt-1 text-[11px] text-thistle-500">Where the live connectivity test will be sent. Defaults to your account email.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Mailgun Private API Key</label>
          <input
            type="password"
            value={mailgunKey}
            onChange={(e) => setMailgunKey(e.target.value)}
            placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            required
            className="w-full px-4 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm font-mono focus:outline-none focus:border-gold-500"
          />
          <p className="mt-1 text-[10px] text-thistle-500">Primary Account or Sending Key from Mailgun Settings → API Security.</p>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-gold-500/35">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-thistle-500 hover:text-royal-950"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={connecting}
            className="px-5 py-2 btn-royal text-xs font-bold rounded-xl"
          >
            {connecting ? 'Running Live Send Test...' : 'Authenticate & Test'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};