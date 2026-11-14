import React, { useEffect } from 'react';
import { Icons } from '../../lib/icons';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = true,
  loading = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white border border-gold-500/45 rounded-2xl p-6 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            danger
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : 'bg-thistle-100 text-royal-700 border border-gold-500/35'
          }`}>
            <Icons.Warning />
          </div>
          <div>
            <h3 className="text-sm font-black text-royal-950">{title}</h3>
            <p className="text-xs text-royal-950/75 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-gold-500/35 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-bold text-thistle-500 hover:text-royal-950 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'btn-royal'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};