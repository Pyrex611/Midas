import React, { useState } from 'react';
import { senderAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

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
  const [deletingSenderId, setDeletingSenderId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!deletingSenderId) return;
    setDeleting(true);
    try {
      await senderAPI.delete(deletingSenderId);
      toast.info('Sender mailbox removed from rotation', 'Removed');
      setDeletingSenderId(null);
      onRefresh();
    } catch {
      toast.error('Could not remove sender', 'Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border-t border-gold-500/35 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-royal-800 uppercase tracking-wider">Sending Mailboxes (Senders)</h4>
        {sendTestPassedAt && (
          <button
            onClick={() => setFormOpen((prev) => !prev)}
            className="text-xs text-royal-700 hover:text-royal-950 font-bold flex items-center gap-1"
          >
            {formOpen ? <Icons.Close className="text-[11px]" /> : <Icons.Plus className="text-[11px] text-gold-600" />}
            <span>{formOpen ? 'Cancel' : 'Add Sender'}</span>
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleAddSender} className="mb-4 p-4 bg-thistle-50 border border-gold-500/40 rounded-xl flex flex-wrap items-end gap-3 animate-in fade-in duration-150">
          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Local Address</label>
            <div className="flex items-center">
              <input
                type="text"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                placeholder="sales"
                required
                className="w-28 px-2.5 py-1.5 bg-white border border-gold-500/35 rounded-l-lg text-xs font-mono focus:outline-none focus:border-gold-500"
              />
              <span className="px-2.5 py-1.5 border border-l-0 border-gold-500/35 rounded-r-lg bg-thistle-100 text-[11px] text-royal-800 font-mono">
                @{domainName}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Display Name (Optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex Mercer"
              className="px-2.5 py-1.5 bg-white border border-gold-500/35 rounded-lg text-xs focus:outline-none focus:border-gold-500"
            />
          </div>

          <button
            type="submit"
            disabled={addingSender}
            className="px-4 py-1.5 btn-royal rounded-lg text-xs font-bold"
          >
            {addingSender ? 'Creating...' : 'Save Sender'}
          </button>
        </form>
      )}

      {senders.length === 0 ? (
        <p className="text-xs text-thistle-500 italic">
          {sendTestPassedAt ? 'No senders added yet. Add an address (e.g. sales@, alex@) to attach to campaigns.' : 'Pass the send test above before adding mailboxes.'}
        </p>
      ) : (
        <div className="space-y-2">
          {senders.map((sender) => (
            <div key={sender.id} className="flex items-center justify-between p-3 bg-thistle-50/70 border border-gold-500/35 rounded-xl text-xs">
              <div>
                <span className="font-mono font-bold text-royal-950">{sender.localPart}@{domainName}</span>
                {sender.displayName && <span className="text-royal-800/75 ml-2 font-medium">"{sender.displayName}"</span>}
                <span className="text-thistle-500 ml-3 text-[11px]">
                  {sender.sentCountToday}/{sender.dailyLimit} sent today · warmup day {sender.warmupDay}
                </span>
              </div>
              <button
                onClick={() => setDeletingSenderId(sender.id)}
                className="text-thistle-500 hover:text-rose-600 text-xs font-medium transition-colors flex items-center gap-1"
              >
                <Icons.Trash />
                <span>Remove</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deletingSenderId)}
        onClose={() => setDeletingSenderId(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Mailbox Sender"
        description="Campaigns using this address will stop dispatching from it."
        confirmLabel="Remove Sender"
        loading={deleting}
      />
    </div>
  );
};