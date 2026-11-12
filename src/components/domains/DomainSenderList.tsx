import React, { useState } from 'react';
import { senderAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export interface Sender {
  id: string;
  localPart: string;
  displayName: string | null;
  status: string;
  dailyLimit: number;
  sentCountToday: number;
  warmupDay: number;
}

interface DomainSenderListProps {
  domainId: string;
  domainName: string;
  sendTestPassedAt: string | null;
  senders: Sender[];
  onRefresh: () => void;
}

export const DomainSenderList: React.FC<DomainSenderListProps> = ({
  domainId,
  domainName,
  sendTestPassedAt,
  senders,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [localPart, setLocalPart] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [addingSender, setAddingSender] = useState(false);

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPart.trim()) return;

    setAddingSender(true);
    try {
      await senderAPI.create(domainId, localPart.trim(), displayName.trim() || undefined);
      toast.success(`Sender ${localPart.trim()}@ added to rotation`, 'Created');
      setLocalPart('');
      setDisplayName('');
      setFormOpen(false);
      onRefresh();
    } catch {
      toast.error('Could not create sender mailbox', 'Error');
    } finally {
      setAddingSender(false);
    }
  };

  const handleDeleteSender = async (senderId: string) => {
    if (!confirm('Remove this mailbox sender? Campaigns using it will cease sending from this address.')) return;
    try {
      await senderAPI.delete(senderId);
      toast.info('Sender mailbox removed from rotation', 'Removed');
      onRefresh();
    } catch {
      toast.error('Could not remove sender', 'Error');
    }
  };

  return (
    <div className="border-t border-zinc-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Sending Mailboxes (Senders)</h4>
        {sendTestPassedAt && (
          <button
            onClick={() => setFormOpen((prev) => !prev)}
            className="text-xs text-blue-600 hover:text-blue-800 font-bold"
          >
            {formOpen ? 'Cancel' : '+ Add Sender'}
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleAddSender} className="mb-4 p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-wrap items-end gap-3 animate-in fade-in duration-150">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Local Address</label>
            <div className="flex items-center">
              <input
                type="text"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                placeholder="sales"
                required
                className="w-28 px-2.5 py-1.5 border border-zinc-200 rounded-l-lg text-xs font-mono focus:outline-none"
              />
              <span className="px-2.5 py-1.5 border border-l-0 border-zinc-200 rounded-r-lg bg-zinc-100 text-[11px] text-zinc-500 font-mono">
                @{domainName}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Display Name (Optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex Mercer"
              className="px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={addingSender}
            className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
          >
            {addingSender ? 'Creating...' : 'Save Sender'}
          </button>
        </form>
      )}

      {senders.length === 0 ? (
        <p className="text-xs text-zinc-400 italic">
          {sendTestPassedAt ? 'No senders added yet. Add an address (e.g. sales@, alex@) to attach to campaigns.' : 'Pass the send test above before adding mailboxes.'}
        </p>
      ) : (
        <div className="space-y-2">
          {senders.map((sender) => (
            <div key={sender.id} className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200/60 rounded-xl text-xs">
              <div>
                <span className="font-mono font-bold text-zinc-900">{sender.localPart}@{domainName}</span>
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
  );
};