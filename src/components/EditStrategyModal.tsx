import React, { useState, useEffect } from 'react';
import { campaignAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Sheet } from './common/Sheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaign: any;
  onSuccess: () => void;
}

export const EditStrategyModal: React.FC<Props> = ({ isOpen, onClose, campaign, onSuccess }) => {
  const { toast } = useToast();
  const [objective, setObjective] = useState(campaign?.objective || '');
  const [targetTool, setTargetTool] = useState(campaign?.targetTool || '');
  const [extendedObjective, setExtendedObjective] = useState(campaign?.extendedObjective || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && campaign) {
      setObjective(campaign.objective || '');
      setTargetTool(campaign.targetTool || '');
      setExtendedObjective(campaign.extendedObjective || '');
    }
  }, [isOpen, campaign]);

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
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Refine Campaign Strategy"
      description="Guide AI personalization and autonomous objection handling for this sequence."
      width="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Global Objective</label>
          <input
            className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none font-semibold text-royal-950"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. Book a 15-minute discovery call"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">
            Primary Call-to-Action (Calendly / Booking Link / Phone)
          </label>
          <input
            className="w-full p-3 bg-thistle-100/70 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none text-royal-800 font-bold"
            value={targetTool}
            onChange={(e) => setTargetTool(e.target.value)}
            placeholder="e.g. https://cal.com/team/intro"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Extended SDR Guidelines</label>
          <textarea
            className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none text-xs"
            rows={5}
            value={extendedObjective}
            onChange={(e) => setExtendedObjective(e.target.value)}
            placeholder="Explain tone, pricing boundaries, and how the AI should handle objections..."
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
    </Sheet>
  );
};