import React from 'react';

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
  // Find initial outreach drafts
  const initialDrafts = drafts.filter(d => d.useCase === 'initial' && d.isActive);

  return (
    <div className="space-y-6">
      {/* Node 1: Initial Touchpoint */}
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md">
            1
          </div>
          <div className="w-0.5 h-16 bg-blue-200" />
        </div>
        <div className="flex-1 p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Step 1: Initial Cold Outreach</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200/50">
              {initialDrafts.length} Draft Variant(s) Ready
            </span>
          </div>
          <p className="text-xs text-zinc-600">
            {initialDrafts[0]?.subject ? (
              <span>Template: <strong className="text-zinc-900 font-medium font-sans">"{initialDrafts[0].subject}"</strong></span>
            ) : (
              'Outreach fires automatically based on mailbox warmup quotas and active sending hours.'
            )}
          </p>
        </div>
      </div>

      {/* Dynamic Subsequent Steps */}
      {steps.map((step, index) => {
        // Find attached drafts for this specific step
        const stepDrafts = drafts.filter(d => d.useCase === 'followup' && d.stepNumber === step.stepNumber && d.isActive);
        const hasDraft = stepDrafts.length > 0;

        return (
          <div key={index} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white font-black text-sm flex items-center justify-center shadow-md">
                {step.stepNumber + 1}
              </div>
              {index < steps.length - 1 && <div className="w-0.5 h-16 bg-zinc-200" />}
            </div>

            <div className="flex-1 p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Follow-Up Step #{step.stepNumber}
                  </span>
                  {hasDraft ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded font-bold">
                      ✓ {stepDrafts.length} Copy Draft Ready
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-0.5 rounded font-bold">
                      ⚠ No Draft Attached
                    </span>
                  )}
                </div>

                {canEdit && (
                  <button
                    onClick={() => onRemoveStep(index)}
                    className="text-xs text-zinc-400 hover:text-rose-600 transition-colors"
                  >
                    Remove Step
                  </button>
                )}
              </div>

              {/* Display snippet of attached copy if present */}
              {hasDraft && (
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs space-y-0.5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Attached Copy Subject</p>
                  <p className="font-semibold text-zinc-800 truncate font-sans">"{stepDrafts[0].subject}"</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                <span>Send after</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={step.delayDays}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateDelay(index, Number(e.target.value))}
                  className="w-16 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-center font-bold text-zinc-900 focus:outline-none"
                />
                <span>days if prospect has not replied.</span>
              </div>

              {canEdit && (
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">
                    {hasDraft ? 'Generate additional tonal variations:' : 'Required: Generate a draft before step can dispatch'}
                  </span>
                  <button
                    onClick={() => onGenerateDraft(step.stepNumber)}
                    disabled={generatingDraftFor === step.stepNumber}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    {generatingDraftFor === step.stepNumber ? '✨ Synthesizing Copy...' : '✨ Generate AI Follow-Up Draft'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Step Connector */}
      {canEdit && (
        <div className="pl-14">
          <button
            onClick={onAddStep}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs font-bold text-zinc-700 rounded-xl transition-colors"
          >
            + Add Follow-Up Stage
          </button>
        </div>
      )}
    </div>
  );
};