import React from 'react';
import { Icons } from '../../lib/icons';

interface FollowUpStep {
  id?: string;
  stepNumber: number;
  delayDays: number;
}

interface SequenceCanvasProps {
  steps: FollowUpStep[];
  drafts?: any[];
  canEdit: boolean;
  onAddStep: () => void;
  onUpdateDelay: (index: number, days: number) => void;
  onRemoveStep: (index: number) => void;
  onGenerateDraft: (stepNumber: number) => void;
  generatingDraftFor: number | null;
}

export const SequenceCanvas: React.FC<SequenceCanvasProps> = ({
  steps,
  drafts = [],
  canEdit,
  onAddStep,
  onUpdateDelay,
  onRemoveStep,
  onGenerateDraft,
  generatingDraftFor,
}) => {
  const initialDrafts = drafts.filter(d => d.useCase === 'initial' && d.isActive);

  return (
    <div className="space-y-6">
      {/* Node 1: Initial Touchpoint */}
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-2xl bg-royal-700 text-gold-300 border border-gold-400/60 font-black text-sm flex items-center justify-center shadow-md">
            1
          </div>
          <div className="w-0.5 h-16 bg-gold-500/45" />
        </div>
        <div className="flex-1 p-5 card-midas rounded-2xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-royal-700 uppercase tracking-wider">Step 1: Initial Cold Outreach</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
              {initialDrafts.length} Draft Variant(s) Ready
            </span>
          </div>
          <p className="text-xs text-royal-950/75">
            {initialDrafts[0]?.subject ? (
              <span>Template: <strong className="text-royal-950 font-semibold font-sans">"{initialDrafts[0].subject}"</strong></span>
            ) : (
              'Outreach fires automatically based on mailbox warmup quotas and active sending hours.'
            )}
          </p>
        </div>
      </div>

      {/* Dynamic Subsequent Steps */}
      {steps.map((step, index) => {
        const stepDrafts = drafts.filter(d => d.useCase === 'followup' && d.stepNumber === step.stepNumber && d.isActive);
        const hasDraft = stepDrafts.length > 0;

        return (
          <div key={index} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-2xl bg-royal-950 text-gold-400 border border-gold-500/40 font-black text-sm flex items-center justify-center shadow-md">
                {step.stepNumber + 1}
              </div>
              {index < steps.length - 1 && <div className="w-0.5 h-16 bg-gold-500/45" />}
            </div>

            <div className="flex-1 p-5 card-midas rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-royal-800 uppercase tracking-wider">
                    Follow-Up Step #{step.stepNumber}
                  </span>
                  {hasDraft ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
                      <Icons.CheckCircle className="text-[11px]" />
                      <span>{stepDrafts.length} Copy Draft Ready</span>
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-800 border border-gold-400/50 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
                      <Icons.Warning className="text-[11px]" />
                      <span>No Draft Attached</span>
                    </span>
                  )}
                </div>

                {canEdit && (
                  <button
                    onClick={() => onRemoveStep(index)}
                    className="text-xs text-thistle-500 hover:text-rose-600 transition-colors font-semibold"
                  >
                    Remove Step
                  </button>
                )}
              </div>

              {hasDraft && (
                <div className="p-3 bg-thistle-50/70 border border-gold-500/30 rounded-xl text-xs space-y-0.5">
                  <p className="text-[10px] font-bold text-thistle-500 uppercase">Attached Copy Subject</p>
                  <p className="font-semibold text-royal-950 truncate font-sans">"{stepDrafts[0].subject}"</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-royal-950/75">
                <span>Send after</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={step.delayDays}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateDelay(index, Number(e.target.value))}
                  className="w-16 px-2.5 py-1 bg-thistle-50 border border-gold-500/40 rounded-lg text-center font-bold text-royal-950 focus:outline-none focus:border-gold-500"
                />
                <span>days if prospect has not replied.</span>
              </div>

              {canEdit && (
                <div className="pt-2 border-t border-gold-500/30 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-thistle-500">
                    {hasDraft ? 'Generate additional tonal variations:' : 'Required: Generate a draft before step can dispatch'}
                  </span>
                  <button
                    onClick={() => onGenerateDraft(step.stepNumber)}
                    disabled={generatingDraftFor === step.stepNumber}
                    className="text-xs font-bold text-royal-700 hover:text-royal-950 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Icons.Sparkles className="text-gold-600" />
                    <span>{generatingDraftFor === step.stepNumber ? 'Synthesizing Copy...' : 'Generate AI Follow-Up Draft'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {canEdit && (
        <div className="pl-14">
          <button
            onClick={onAddStep}
            className="px-4 py-2 bg-white hover:bg-thistle-100 border border-gold-500/40 text-xs font-bold text-royal-800 rounded-xl glow-gold-hover flex items-center gap-1.5"
          >
            <Icons.Plus className="text-gold-600" />
            <span>Add Follow-Up Stage</span>
          </button>
        </div>
      )}
    </div>
  );
};