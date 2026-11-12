import React, { useState } from 'react';
import { Sheet } from '../../common/Sheet';
import { townCrierAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

interface TownCrierAddRecipientDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TownCrierAddRecipientDrawer: React.FC<TownCrierAddRecipientDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('newsletter');
  const [submittingRecipient, setSubmittingRecipient] = useState(false);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setSubmittingRecipient(true);
    try {
      const tagsArray = newTags.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
      await townCrierAPI.addRecipient(newEmail.trim(), newName.trim() || undefined, tagsArray);
      toast.success(`Subscribed ${newEmail.trim()}`, 'Subscriber Added');
      setNewEmail('');
      setNewName('');
      setNewTags('newsletter');
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to add subscriber'), 'Error');
    } finally {
      setSubmittingRecipient(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Newsletter Subscriber"
      description="Add a single verified subscriber to your Town Crier audience."
      width="md"
    >
      <form onSubmit={handleAddRecipient} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Subscriber Email *</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="subscriber@domain.com"
            required
            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Subscriber Name (Optional)</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Tags (Comma-separated)</label>
          <input
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="newsletter, web-signup"
            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submittingRecipient}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs"
          >
            {submittingRecipient ? 'Adding...' : 'Subscribe'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};