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

export const EditStrategyModal: React.FC<Props> = ({ isOpen, onClose, campaign, onSuccess }) => {
  const { toast } = useToast();
  const [objective, setObjective] = useState(campaign.objective || '');
  const [targetTool, setTargetTool] = useState(campaign.targetTool || '');
  const [extendedObjective, setExtendedObjective] = useState(campaign.extendedObjective || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && campaign) {
      setObjective(campaign.objective || '');
      setTargetTool(campaign.targetTool || '');
      setExtendedObjective(campaign.extendedObjective || '');
    }
  }, [isOpen, campaign]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await campaignAPI.updateStrategy(campaign.id, {
        objective,
        targetTool,
        extendedObjective,
      });
      toast.success('Campaign SDR strategy updated', 'Strategy Saved');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update strategy'), 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white border border-gold-500/45 rounded-3xl w-full max-w-xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-5 border-b border-gold-500/35">
          <h3 className="text-lg font-black text-royal-950 tracking-tight">Refine Campaign Strategy</h3>
          <button onClick={onClose} className="text-thistle-500 hover:text-royal-950 p-1">
            <Icons.Close />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Global Objective</label>
            <input
              className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none font-semibold text-royal-950"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Book a discovery call"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Conversion Tool (Phone/Link)</label>
            <input
              className="w-full p-3 bg-thistle-100/70 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none text-royal-800 font-bold"
              value={targetTool}
              onChange={(e) => setTargetTool(e.target.value)}
              placeholder="e.g. +1 (400) XXX-XXXX or Calendly link"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Extended SDR Instructions</label>
            <textarea
              className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none text-xs"
              rows={4}
              value={extendedObjective}
              onChange={(e) => setExtendedObjective(e.target.value)}
              placeholder="Explain the nuance of how the AI should handle objections and talk to leads..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gold-500/35">
            <button type="button" onClick={onClose} className="px-4 py-2 text-thistle-500 hover:text-royal-950 font-bold">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 btn-royal font-bold rounded-xl">
              {submitting ? 'Updating...' : 'Save Strategy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};