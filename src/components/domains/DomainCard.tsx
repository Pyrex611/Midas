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
  bounceRate: number;
  complaintRate: number;
  sendTestPassedAt: string | null;
  receivingConfirmedAt: string | null;
  receivingTestAddress: string | null;
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

  const isReceivingConfirmed = domain.receivingConfirmedAt || receivingState?.confirmed;

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
          <div className="flex items-center gap-3">
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

        <div className="flex items-center gap-2">
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

      {domain.keyDecryptionFailed && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2.5">
          <Icons.Warning className="text-rose-600" />
          <span>
            <strong>Mailgun Key Unreadable:</strong> Stored API key failed decryption (<code className="font-mono">ENCRYPTION_KEY</code> may have rotated). Delete and reconnect this domain to resume sends.
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

      {domain.sendTestPassedAt && !isReceivingConfirmed && (
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