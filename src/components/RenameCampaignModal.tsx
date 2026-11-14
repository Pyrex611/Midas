import React, { useState, useEffect } from 'react';
import { campaignAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaign: any;
  onSuccess: () => void;
}

export const RenameCampaignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  campaign,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState(campaign.name || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && campaign?.name) {
      setName(campaign.name);
    }
  }, [isOpen, campaign?.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await campaignAPI.update(campaign.id, { name: name.trim() });
      toast.success('Campaign renamed', 'Saved');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Could not rename campaign'), 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white border border-gold-500/45 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gold-500/35">
          <h3 className="text-base font-black text-royal-950">Rename Campaign</h3>
          <button onClick={onClose} className="text-thistle-500 hover:text-royal-950 p-1">
            <Icons.Close />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-semibold text-royal-950 focus:outline-none focus:border-gold-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gold-500/35">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-thistle-500 hover:text-royal-950 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 btn-royal rounded-xl font-bold"
            >
              {submitting ? 'Saving...' : 'Save Name'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};