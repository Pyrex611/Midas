import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

interface TownCrierRevealedKeyCardProps {
  apiKey: string;
  onDismiss: () => void;
}

export const TownCrierRevealedKeyCard: React.FC<TownCrierRevealedKeyCardProps> = ({
  apiKey,
  onDismiss,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success('API Key copied to clipboard', 'Copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy key', 'Error');
    }
  };

  return (
    <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Your New Town Crier API Key</span>
        <button onClick={onDismiss} className="text-amber-700 hover:text-amber-950 font-bold text-xs">✕ Dismiss</button>
      </div>
      <p className="text-xs text-amber-800">
        Copy and store this API key safely now. For security, it will <strong>never be shown again</strong>.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={apiKey}
          className="flex-1 px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-zinc-900 select-all"
        />
        <button
          onClick={copyKey}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
        >
          {copied ? (
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
  );
};