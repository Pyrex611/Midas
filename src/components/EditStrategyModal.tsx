import React, { useState, useEffect } from 'react';
import { campaignAPI, aiAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Sheet } from './common/Sheet';
import { Icons } from '../lib/icons';

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
  const [context, setContext] = useState(campaign?.context || '');
  const [reference, setReference] = useState(campaign?.reference || '');
  const [senderName, setSenderName] = useState(campaign?.senderName || '');
  const [optimizing, setOptimizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && campaign) {
      setObjective(campaign.objective || '');
      setTargetTool(campaign.targetTool || '');
      setExtendedObjective(campaign.extendedObjective || '');
      setContext(campaign.context || '');
      setReference(campaign.reference || '');
      setSenderName(campaign.senderName || '');
    }
  }, [isOpen, campaign]);

  const handleOptimizeContext = async () => {
    if (!context.trim()) return;
    setOptimizing(true);
    try {
      const res = await aiAPI.optimizeContext(context);
      setContext(res.data.optimized);
      toast.success('Campaign context refined by AI', 'Optimized');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not optimize context'), 'AI Error');
    } finally {
      setOptimizing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await campaignAPI.updateStrategy(campaign.id, {
        objective,
        targetTool,
        extendedObjective,
        context,
        reference,
        senderName,
      });
      toast.success('Campaign strategy & copywriting context updated', 'Saved');
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
      title="Refine Campaign Strategy & Context"
      description="Configure SDR conversion goals, AI drafting context, reference case studies, and fallback sender identity."
      width="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              Fallback Sender Display Name
            </label>
            <input
              className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none font-semibold text-royal-950"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="e.g. Alex Mercer (used if sender has no display name)"
            />
          </div>
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

        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[10px] font-bold text-thistle-500 uppercase">
              Campaign Goal / AI Drafting Context
            </label>
            <button
              type="button"
              onClick={handleOptimizeContext}
              disabled={optimizing || !context.trim()}
              className="px-2.5 py-1 btn-royal text-[10px] rounded-lg font-bold flex items-center gap-1"
            >
              <Icons.Sparkles className="text-gold-300" />
              <span>{optimizing ? 'Optimizing...' : 'Optimize Context'}</span>
            </button>
          </div>
          <textarea
            className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none text-xs"
            rows={4}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Explain your offer, target ICP pain points, and core value mechanism..."
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">
            Reference Story / Past Client (Optional)
          </label>
          <textarea
            className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none text-xs"
            rows={3}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. Helped ACME Corp reduce operational overhead by 30%..."
          />
          <p className="mt-1 text-[10px] text-thistle-500">
            Referenced by AI drafts via <code className="font-mono">{'{{reference_company}}'}</code>.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Extended SDR Guidelines</label>
          <textarea
            className="w-full p-3 bg-thistle-50 rounded-xl border border-gold-500/40 focus:border-gold-500 outline-none text-xs"
            rows={4}
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
            {submitting ? 'Updating...' : 'Save Strategy & Context'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};