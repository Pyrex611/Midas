import React, { useEffect, useState } from 'react';
import { sandboxAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

export const SandboxCard: React.FC = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<{
    available: boolean;
    domain: string | null;
    sentToday: number;
    dailyLimit: number;
    remainingToday: number;
  } | null>(null);
  const [sending, setSending] = useState(false);

  const loadStatus = () => {
    sandboxAPI
      .getStatus()
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTestSend = async () => {
    setSending(true);
    try {
      const res = await sandboxAPI.sendTest();
      toast.success(
        `Sandbox email delivered via ${res.data.sandboxDomain}! Check your personal inbox.`,
        'Sandbox Verified'
      );
      loadStatus();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Sandbox test failed'), 'Sandbox Error');
    } finally {
      setSending(false);
    }
  };

  if (!status || !status.available) return null;

  return (
    <div className="p-5 card-midas rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-royal-700 text-gold-300 border border-gold-400/50 flex items-center justify-center shrink-0">
          <Icons.Bolt className="text-lg" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-black uppercase tracking-wider text-royal-950">
              Zero-Setup Sandbox Mode
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-thistle-100 text-royal-800 border border-gold-500/35">
              {status.remainingToday}/{status.dailyLimit} left today
            </span>
          </div>
          <p className="text-xs text-royal-950/75 mt-0.5 leading-relaxed">
            Test live email delivery directly to your own verified account email via{' '}
            <code className="font-mono font-bold text-royal-800">{status.domain}</code> before setting up custom DNS.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleTestSend}
        disabled={sending || status.remainingToday <= 0}
        className="px-4 py-2 btn-royal rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
      >
        <Icons.Send className="text-gold-300" />
        <span>{sending ? 'Sending...' : 'Send Sandbox Test to Me'}</span>
      </button>
    </div>
  );
};