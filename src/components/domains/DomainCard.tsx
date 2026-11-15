import React, { useState } from 'react';
import { domainAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DomainSenderList } from './DomainSenderList';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

export interface DomainCardData {
  id: string;
  domainName: string;
  status: string;
  espProvider?: string;
  bounceRate: number;
  complaintRate: number;
  sendTestPassedAt: string | null;
  receivingConfirmedAt: string | null;
  receivingTestAddress: string | null;
  spfStatus?: boolean;
  dkimStatus?: boolean;
  mxStatus?: boolean;
  trackingStatus?: boolean;
  trackingDomain?: string | null;
  trackingHostnameStatus?: string | null;
  bimiEnabled: boolean;
  bimiSvgUrl: string | null;
  bimiVmcUrl: string | null;
  dmarcPolicy: string | null;
  keyDecryptionFailed?: boolean;
  senders: any[];
}

interface DomainCardProps {
  domain: DomainCardData;
  onOpenBimiDrawer: (domain: DomainCardData) => void;
  onRefresh: () => void;
  testRecipientEmail?: string;
}

export const DomainCard: React.FC<DomainCardProps> = ({
  domain,
  onOpenBimiDrawer,
  onRefresh,
  testRecipientEmail,
}) => {
  const { toast } = useToast();
  const [checkingReceiving, setCheckingReceiving] = useState(false);
  const [receivingState, setReceivingState] = useState<{ confirmed?: boolean; testAddress?: string; testCode?: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [inspectingDns, setInspectingDns] = useState(false);
  const [dnsReport, setDnsReport] = useState<any | null>(null);
  const [trackingFormOpen, setTrackingFormOpen] = useState(false);
  const [trackingInput, setTrackingInput] = useState(domain.trackingDomain || `track.${domain.domainName}`);
  const [savingTracking, setSavingTracking] = useState(false);

  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const isReceivingConfirmed = domain.receivingConfirmedAt || receivingState?.confirmed;

  const handleToggleSnapshots = async () => {
    const next = !snapshotsOpen;
    setSnapshotsOpen(next);
    if (next && snapshots.length === 0) {
      setLoadingSnapshots(true);
      try {
        const res = await domainAPI.getSnapshots(domain.id, 14);
        setSnapshots(res.data || []);
      } catch {
        toast.error('Failed to load daily health snapshots', 'Error');
      } finally {
        setLoadingSnapshots(false);
      }
    }
  };

  const handleInspectDns = async () => {
    setInspectingDns(true);
    try {
      const res = await domainAPI.inspectDns(domain.id);
      setDnsReport(res.data);
      toast.success('Authoritative DNS inspection complete', 'DNS Updated');
      onRefresh();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'DNS lookup failed'), 'DNS Error');
    } finally {
      setInspectingDns(false);
    }
  };

  const handleSaveTrackingDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingInput.trim()) return;
    setSavingTracking(true);
    try {
      const res = await domainAPI.setTrackingDomain(domain.id, trackingInput.trim());
      toast.success(
        `Tracking domain ${res.data.trackingDomain} saved. Point CNAME to ${res.data.expectedCnameTarget}`,
        'Tracking CNAME'
      );
      setTrackingFormOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not configure tracking hostname'), 'Error');
    } finally {
      setSavingTracking(false);
    }
  };

  const handleRetrySendTest = async () => {
    try {
      await domainAPI.retrySendTest(domain.id, testRecipientEmail || undefined);
      toast.success('Live test send passed!', 'Verified');
      onRefresh();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Send test failed again'), 'Send Test Failed');
    }
  };

  const handleResetReceivingTest = async () => {
    try {
      await domainAPI.resetReceivingTest(domain.id);
      toast.info('New one-time verification code generated', 'Code Reset');
      onRefresh();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not reset the receiving test'), 'Error');
    }
  };

  const handleCheckReceiving = async () => {
    setCheckingReceiving(true);
    try {
      const res = await domainAPI.checkReceivingTest(domain.id);
      setReceivingState(res.data);
      if (res.data.confirmed) {
        toast.success('Inbound reply routing confirmed!', 'Domain Ready');
        onRefresh();
      } else {
        toast.info('Inbound test not yet detected. Ensure code was sent.', 'Pending');
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not check receiving status'), 'Error');
    } finally {
      setCheckingReceiving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await domainAPI.delete(domain.id);
      toast.info('Domain and mailboxes deleted', 'Deleted');
      setConfirmDeleteOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not delete domain'), 'Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card-midas rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            {domain.bimiEnabled && domain.bimiSvgUrl ? (
              <img
                src={domain.bimiSvgUrl}
                alt={`${domain.domainName} Avatar`}
                className="w-7 h-7 rounded-full border border-gold-500/60 object-cover bg-white shadow-2xs"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-royal-700 text-gold-300 font-bold text-xs flex items-center justify-center border border-gold-400/50">
                {domain.domainName.charAt(0).toUpperCase()}
              </div>
            )}

            <h3 className="text-xl font-bold text-royal-950 tracking-tight font-mono">{domain.domainName}</h3>
            <span className="px-2 py-0.5 rounded bg-thistle-100 text-royal-800 border border-gold-500/35 text-[10px] font-mono font-bold uppercase">
              {domain.espProvider || 'mailgun'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs flex-wrap pt-1">
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
              domain.sendTestPassedAt
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              Outbound: {domain.sendTestPassedAt ? 'VERIFIED' : 'FAILED'}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
              isReceivingConfirmed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-gold-400/50'
            }`}>
              Replies: {isReceivingConfirmed ? 'VERIFIED' : 'PENDING CODE'}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              domain.bimiEnabled
                ? 'bg-thistle-100 text-royal-800 border-gold-500/45'
                : 'bg-thistle-50 text-thistle-500 border-gold-500/25'
            }`}>
              Avatar: {domain.bimiEnabled ? 'ACTIVE (BIMI)' : 'NOT CONFIGURED'}
            </span>
            <span className="text-thistle-500 ml-2">Bounce rate: {(domain.bounceRate * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleToggleSnapshots}
            className="px-3 py-1.5 bg-white hover:bg-thistle-100 border border-gold-500/40 text-royal-800 rounded-xl text-xs font-bold"
          >
            {snapshotsOpen ? 'Hide Trends' : 'Health Trends (14d)'}
          </button>

          <button
            onClick={handleInspectDns}
            disabled={inspectingDns}
            className="px-3 py-1.5 bg-white hover:bg-thistle-100 border border-gold-500/40 text-royal-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.Refresh className={inspectingDns ? 'animate-spin text-gold-600' : 'text-gold-600'} />
            <span>{inspectingDns ? 'Scanning DNS...' : 'Verify DNS'}</span>
          </button>

          <button
            onClick={() => onOpenBimiDrawer(domain)}
            className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.Image className="text-gold-300" />
            <span>{domain.bimiEnabled ? 'Manage Avatar' : 'Setup Avatar'}</span>
          </button>

          <button
            onClick={() => setConfirmDeleteOpen(true)}
            className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
          >
            <Icons.Trash />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Authoritative DNS & Custom Tracking Bar */}
      <div className="p-3 bg-thistle-50/70 border border-gold-500/35 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase text-thistle-500">DNS Records:</span>
          {[
            ['SPF', domain.spfStatus],
            ['DKIM', domain.dkimStatus],
            ['MX', domain.mxStatus],
            ['DMARC', domain.dmarcPolicy && domain.dmarcPolicy !== 'missing'],
            ['Tracking CNAME', domain.trackingStatus],
          ].map(([label, ok]) => (
            <span
              key={label as string}
              className={`px-2 py-0.5 rounded font-mono font-bold border ${
                ok
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white text-thistle-500 border-gold-500/30'
              }`}
            >
              {label as string}: {ok ? 'OK' : 'UNSET'}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTrackingFormOpen((prev) => !prev)}
          className="text-xs font-bold text-royal-700 hover:underline whitespace-nowrap"
        >
          {domain.trackingDomain ? `Tracking: ${domain.trackingDomain}` : '+ Custom Tracking CNAME'}
        </button>
      </div>

      {snapshotsOpen && (
        <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-2 text-xs">
          <p className="font-bold text-royal-950">Daily Deliverability Snapshots (Human Opens vs Bounces)</p>
          {loadingSnapshots ? (
            <p className="text-thistle-500">Loading snapshots...</p>
          ) : snapshots.length === 0 ? (
            <p className="text-thistle-500 italic">No daily snapshots recorded yet (runs via /api/cron/snapshots).</p>
          ) : (
            <div className="overflow-x-auto bg-white border border-gold-500/35 rounded-lg">
              <table className="min-w-full divide-y divide-gold-500/20 text-[11px] font-mono">
                <thead className="bg-thistle-100/75 text-royal-800">
                  <tr>
                    <th className="py-1.5 px-3 text-left">Date</th>
                    <th className="py-1.5 px-3 text-right">Sent</th>
                    <th className="py-1.5 px-3 text-right">Human Opens</th>
                    <th className="py-1.5 px-3 text-right">Clicks</th>
                    <th className="py-1.5 px-3 text-right">Replies</th>
                    <th className="py-1.5 px-3 text-right">Bounces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-500/15">
                  {snapshots.map((snap) => (
                    <tr key={snap.id}>
                      <td className="py-1.5 px-3">{snap.snapshotDate}</td>
                      <td className="py-1.5 px-3 text-right font-bold">{snap.sentCount}</td>
                      <td className="py-1.5 px-3 text-right text-royal-700">{snap.humanOpenCount}</td>
                      <td className="py-1.5 px-3 text-right">{snap.clickCount}</td>
                      <td className="py-1.5 px-3 text-right text-emerald-700">{snap.replyCount}</td>
                      <td className="py-1.5 px-3 text-right text-rose-600">{snap.bounceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {dnsReport && (
        <div className="p-3.5 bg-white border border-gold-500/40 rounded-xl text-[11px] space-y-1.5">
          <p className="font-bold text-royal-950">Live Authoritative DNS Lookup Results</p>
          <p className="font-mono text-thistle-500 truncate">SPF: {dnsReport.spf.record || 'Not published'}</p>
          <p className="font-mono text-thistle-500 truncate">
            DKIM: {dnsReport.dkim.verified ? `Selector "${dnsReport.dkim.matchedSelector}" verified` : 'No standard selector found'}
          </p>
          <p className="font-mono text-thistle-500 truncate">
            DMARC: {dnsReport.dmarc.record || 'Missing _dmarc TXT record'}
          </p>
        </div>
      )}

      {trackingFormOpen && (
        <form onSubmit={handleSaveTrackingDomain} className="p-3.5 bg-thistle-50 border border-gold-500/40 rounded-xl flex flex-wrap items-end gap-3 text-xs">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
              Custom Tracking Hostname (CNAME Target)
            </label>
            <input
              type="text"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              placeholder={`track.${domain.domainName}`}
              className="w-full px-3 py-1.5 bg-white border border-gold-500/40 rounded-lg font-mono text-xs focus:outline-none focus:border-gold-500"
            />
          </div>
          <button type="submit" disabled={savingTracking} className="px-4 py-1.5 btn-royal rounded-lg text-xs font-bold">
            {savingTracking ? 'Saving...' : 'Save Tracking CNAME'}
          </button>
        </form>
      )}

      {domain.keyDecryptionFailed && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2.5">
          <Icons.Warning className="text-rose-600" />
          <span>
            <strong>Credential Unreadable:</strong> Stored API key failed decryption (<code className="font-mono">ENCRYPTION_KEY</code> may have rotated). Delete and reconnect this domain to resume sends.
          </span>
        </div>
      )}

      {!domain.sendTestPassedAt && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold">The test send failed for this domain.</p>
            <p className="opacity-90 mt-0.5">Ensure the domain matches Mailgun and the API key matches the configured region.</p>
          </div>
          <button
            onClick={handleRetrySendTest}
            className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors whitespace-nowrap"
          >
            Retry Test Send
          </button>
        </div>
      )}

      {domain.sendTestPassedAt && !isReceivingConfirmed && (domain.espProvider || 'mailgun') === 'mailgun' && (
        <div className="p-4 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs text-royal-950 space-y-2">
          <p className="font-bold text-royal-800">Step 2: Confirm Inbound Reply Routing</p>
          <p className="text-royal-950/75">
            Send an email from an external inbox to{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-gold-500/35 font-mono font-bold">
              {receivingState?.testAddress || domain.receivingTestAddress}
            </code>{' '}
            with this code in the message:{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-gold-500/35 font-mono font-bold text-royal-700">
              {receivingState?.testCode || '(click Check Status to load)'}
            </code>
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCheckReceiving}
              disabled={checkingReceiving}
              className="px-3.5 py-1.5 btn-royal rounded-lg text-xs font-bold"
            >
              {checkingReceiving ? 'Verifying...' : 'Check Status'}
            </button>
            <button
              onClick={handleResetReceivingTest}
              className="px-3.5 py-1.5 bg-white border border-gold-500/35 text-royal-800 rounded-lg text-xs font-bold hover:bg-thistle-100"
            >
              Regenerate Code
            </button>
          </div>
        </div>
      )}

      <DomainSenderList
        domainId={domain.id}
        domainName={domain.domainName}
        sendTestPassedAt={domain.sendTestPassedAt}
        senders={domain.senders || []}
        onRefresh={onRefresh}
      />

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete Domain "${domain.domainName}"`}
        description="All associated mailbox senders and campaign linkages will be permanently removed."
        confirmLabel="Delete Domain"
        loading={deleting}
      />
    </div>
  );
};