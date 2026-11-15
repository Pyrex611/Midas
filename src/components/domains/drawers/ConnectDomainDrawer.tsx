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
  const [espTab, setEspTab] = useState<'mailgun' | 'resend' | 'smtp'>('mailgun');

  const [newDomain, setNewDomain] = useState('');
  const [mailgunKey, setMailgunKey] = useState('');
  const [region, setRegion] = useState<'us' | 'eu'>('us');
  const [testRecipientEmail, setTestRecipientEmail] = useState('');

  // Resend & SMTP fields
  const [resendKey, setResendKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setConnecting(true);
    try {
      if (espTab === 'mailgun') {
        await domainAPI.connect(
          newDomain.trim(),
          mailgunKey.trim(),
          region,
          testRecipientEmail.trim() || undefined
        );
        toast.success(`Mailgun domain ${newDomain} connected & send-test verified!`, 'Verified');
      } else if (espTab === 'resend') {
        await domainAPI.connectEsp({
          domainName: newDomain.trim(),
          espProvider: 'resend',
          apiKey: resendKey.trim(),
        });
        toast.success(`Resend domain ${newDomain} connected for Town Crier newsletters!`, 'Connected');
      } else {
        await domainAPI.connectEsp({
          domainName: newDomain.trim(),
          espProvider: 'smtp',
          smtpConfig: {
            host: smtpHost.trim(),
            port: Number(smtpPort) || 587,
            secure: smtpSecure,
            user: smtpUser.trim(),
            pass: smtpPass,
          },
        });
        toast.success(`Custom SMTP domain ${newDomain} connected!`, 'Connected');
      }

      setNewDomain('');
      setMailgunKey('');
      setResendKey('');
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
      description="Choose your Email Service Provider (ESP). All keys and SMTP credentials are encrypted with AES-256-GCM."
      width="lg"
    >
      <form onSubmit={handleConnect} className="space-y-4">
        <div className="flex p-1 bg-thistle-100 border border-gold-500/35 rounded-xl gap-1 text-xs">
          {[
            ['mailgun', 'Mailgun (All Engines)'],
            ['resend', 'Resend (Town Crier)'],
            ['smtp', 'Custom SMTP'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setEspTab(key as any)}
              className={`flex-1 py-1.5 font-bold rounded-lg transition-colors ${
                espTab === key ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800 hover:bg-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {espTab === 'resend' && (
          <div className="p-3 bg-amber-50 border border-gold-400/60 rounded-xl text-[11px] text-amber-900">
            <strong>Resend AUP Guardrail:</strong> Resend prohibits unsolicited cold email. MIDAS automatically restricts Resend domains to Town Crier newsletters &amp; opt-in autoresponders.
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Domain Name *</label>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. outreach.company.com"
            required
            className="w-full px-4 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm font-mono focus:outline-none focus:border-gold-500"
          />
        </div>

        {espTab === 'mailgun' && (
          <>
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
            </div>

            <div>
              <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Mailgun Private API Key *</label>
              <input
                type="password"
                value={mailgunKey}
                onChange={(e) => setMailgunKey(e.target.value)}
                placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                className="w-full px-4 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm font-mono focus:outline-none focus:border-gold-500"
              />
            </div>
          </>
        )}

        {espTab === 'resend' && (
          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Resend API Key *</label>
            <input
              type="password"
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
              required
              className="w-full px-4 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-sm font-mono focus:outline-none focus:border-gold-500"
            />
          </div>
        )}

        {espTab === 'smtp' && (
          <div className="space-y-3 p-4 bg-thistle-50 border border-gold-500/35 rounded-xl text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">SMTP Host *</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Port *</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">SMTP Username *</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  required
                  placeholder="alex@company.com"
                  className="w-full px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">App Password *</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="rounded border-thistle-400 text-royal-700"
              />
              <span className="font-semibold text-royal-950">Use Direct TLS (Port 465)</span>
            </label>
          </div>
        )}

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
            {connecting ? 'Connecting...' : espTab === 'mailgun' ? 'Authenticate & Test' : 'Save Domain Provider'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};