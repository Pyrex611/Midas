import React, { useState } from 'react';
import { domainAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DomainSenderList } from './DomainSenderList';

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

  const handleDeleteDomain = async () => {
    if (!confirm('Delete this domain? All its senders and campaign linkages will be purged.')) return;
    try {
      await domainAPI.delete(domain.id);
      toast.info('Domain and mailboxes deleted', 'Deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not delete domain'), 'Error');
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {domain.bimiEnabled && domain.bimiSvgUrl ? (
              <img
                src={domain.bimiSvgUrl}
                alt={`${domain.domainName} Avatar`}
                className="w-7 h-7 rounded-full border border-purple-300 object-cover bg-white shadow-2xs"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-400 font-bold text-xs flex items-center justify-center border border-zinc-200">
                {domain.domainName.charAt(0).toUpperCase()}
              </div>
            )}

            <h3 className="text-xl font-bold text-zinc-900 tracking-tight font-mono">{domain.domainName}</h3>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs flex-wrap pt-1">
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
              domain.sendTestPassedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              Outbound: {domain.sendTestPassedAt ? 'VERIFIED' : 'FAILED'}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
              isReceivingConfirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              Replies: {isReceivingConfirmed ? 'VERIFIED' : 'PENDING CODE'}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              domain.bimiEnabled
                ? 'bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs'
                : 'bg-zinc-100 text-zinc-500'
            }`}>
              Avatar: {domain.bimiEnabled ? 'ACTIVE (BIMI)' : 'NOT CONFIGURED'}
            </span>
            <span className="text-zinc-500 ml-2">Bounce rate: {(domain.bounceRate * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenBimiDrawer(domain)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
              domain.bimiEnabled
                ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <span>🖼️</span>
            <span>{domain.bimiEnabled ? 'Manage Avatar' : 'Setup Avatar'}</span>
          </button>

          <button
            onClick={handleDeleteDomain}
            className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {!domain.sendTestPassedAt && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-950 space-y-2">
          <p className="font-bold">Step 2: Confirm Inbound Reply Routing</p>
          <p className="text-zinc-600">
            Send an email from an external inbox to{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono font-bold">
              {receivingState?.testAddress || domain.receivingTestAddress}
            </code>{' '}
            with this code in the message:{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono font-bold text-blue-700">
              {receivingState?.testCode || '(click Check Status to load)'}
            </code>
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCheckReceiving}
              disabled={checkingReceiving}
              className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {checkingReceiving ? 'Verifying...' : 'Check Status'}
            </button>
            <button
              onClick={handleResetReceivingTest}
              className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-50"
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
    </div>
  );
};