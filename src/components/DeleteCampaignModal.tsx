import React, { useState } from 'react';
import { Icons } from '../lib/icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  campaignName: string;
}

export const DeleteCampaignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  campaignName,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== campaignName) return;
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white border border-gold-500/45 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-150 space-y-4 text-xs">
        <div className="flex items-start gap-3 pb-3 border-b border-gold-500/35">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <Icons.Warning />
          </div>
          <div>
            <h3 className="text-base font-black text-royal-950">Delete Campaign</h3>
            <p className="text-royal-950/75 mt-0.5">
              Permanently delete <strong>{campaignName}</strong>? This action cannot be undone.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
            Type the campaign name to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-mono text-royal-950 focus:outline-none focus:border-rose-500"
            placeholder={campaignName}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gold-500/35">
          <button
            onClick={onClose}
            className="px-4 py-2 text-thistle-500 hover:text-royal-950 font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== campaignName}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};