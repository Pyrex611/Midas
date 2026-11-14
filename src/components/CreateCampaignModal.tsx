import React, { useState, useEffect } from 'react';
import { campaignAPI, aiAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialLeadIds?: string[];
  defaultSenderName?: string;
}

export const CreateCampaignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  initialLeadIds,
  defaultSenderName,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [context, setContext] = useState('');
  const [reference, setReference] = useState('');
  const [senderName, setSenderName] = useState(defaultSenderName || '');

  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const [originalContext, setOriginalContext] = useState('');
  const [isOptimized, setIsOptimized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setObjective('');
      setContext('');
      setReference('');
      setOriginalContext('');
      setIsOptimized(false);
      setSenderName(defaultSenderName || '');
    }
  }, [isOpen, defaultSenderName]);

  const handleOptimize = async () => {
    if (!context.trim()) return;
    setOriginalContext(context);
    setOptimizing(true);
    try {
      const res = await aiAPI.optimizeContext(context);
      setContext(res.data.optimized);
      setIsOptimized(true);
      toast.success('Campaign context refined by AI', 'Optimized');
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Could not optimize context'), 'AI Error');
    } finally {
      setOptimizing(false);
    }
  };

  const handleRevert = () => {
    setContext(originalContext);
    setIsOptimized(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await campaignAPI.create({
        name,
        description,
        objective,
        context,
        reference,
        senderName,
        leadIds: initialLeadIds,
      });
      toast.success(`Campaign "${name.trim()}" created`, 'Sequence Ready');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Could not create campaign'), 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white border border-gold-500/45 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-5 border-b border-gold-500/35">
          <h3 className="text-lg font-black text-royal-950 tracking-tight">Create New Campaign</h3>
          <button onClick={onClose} className="text-thistle-500 hover:text-royal-950 p-1">
            <Icons.Close />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
              Campaign Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500 font-semibold text-royal-950"
              placeholder="e.g., Q1 Outreach – Software Engineers"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
              placeholder="Brief description of this campaign"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
              Primary Objective <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
              placeholder="e.g. Book a 15-minute discovery call"
              required
            />
          </div>

          <div className="relative">
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
              Campaign Goal / Context (Crucial for AI drafting)
            </label>
            <textarea
              value={context}
              onChange={(e) => {
                setContext(e.target.value);
                if (isOptimized) setIsOptimized(false);
              }}
              rows={3}
              className="w-full px-3.5 py-2 pr-24 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
              placeholder="e.g., Propose my services as a senior software engineer, emphasize value I can add to their team."
              required
            />

            <div className="absolute right-2 top-7">
              {!isOptimized ? (
                <button
                  type="button"
                  onClick={handleOptimize}
                  disabled={optimizing || !context.trim()}
                  className="px-3 py-1 btn-royal text-xs rounded-lg font-bold flex items-center gap-1"
                >
                  <Icons.Sparkles className="text-gold-300" />
                  <span>{optimizing ? 'Optimizing...' : 'Optimize'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRevert}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg font-bold flex items-center gap-1"
                >
                  <Icons.Refresh />
                  <span>Revert</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
              Reference Story / Past Client (Optional)
            </label>
            <textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
              placeholder="e.g., I helped ACME Corp increase pipeline conversion by 30%..."
            />
            <p className="mt-1 text-[10px] text-thistle-500">
              If provided, AI drafts may reference this case study using <code className="font-mono">{'{{reference_company}}'}</code>.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
              Sender Name (Optional)
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
              placeholder="e.g., Alex Mercer"
            />
          </div>

          {initialLeadIds && initialLeadIds.length > 0 && (
            <div className="p-3 bg-thistle-100 border border-gold-500/35 text-royal-800 rounded-xl font-bold">
              This campaign will launch immediately with {initialLeadIds.length} lead(s) queued.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gold-500/35">
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
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};