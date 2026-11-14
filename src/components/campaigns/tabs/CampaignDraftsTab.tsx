import React from 'react';
import { DeliverabilityGrader } from '../DeliverabilityGrader';
import { SpintaxSimulator } from '../SpintaxSimulator';
import { Icons } from '../../../lib/icons';

interface CampaignDraftsTabProps {
  campaignId: string;
  drafts: any[];
  canEdit: boolean;
  onGenerateAiDraft: () => void;
  onOpenCustomDraftModal: () => void;
  onEditDraft: (draft: any) => void;
  onDeleteDraft: (draftId: string) => void;
  generatingDraft: boolean;
}

export const CampaignDraftsTab: React.FC<CampaignDraftsTabProps> = ({
  campaignId,
  drafts,
  canEdit,
  onGenerateAiDraft,
  onOpenCustomDraftModal,
  onEditDraft,
  onDeleteDraft,
  generatingDraft,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-3 border-b border-gold-500/35">
        <h3 className="text-xs font-bold text-thistle-500 uppercase tracking-wider">Copywriting Variations ({drafts.length})</h3>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={onGenerateAiDraft}
              disabled={generatingDraft}
              className="px-3.5 py-1.5 btn-royal text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Icons.Sparkles className="text-gold-300" />
              <span>{generatingDraft ? 'Synthesizing...' : 'Generate AI Variation'}</span>
            </button>
            <button
              onClick={onOpenCustomDraftModal}
              className="px-3.5 py-1.5 bg-white hover:bg-thistle-100 border border-gold-500/40 text-royal-800 text-xs font-bold rounded-xl glow-gold-hover flex items-center gap-1.5"
            >
              <Icons.Plus className="text-gold-600" />
              <span>Custom Draft</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {drafts.map((draft: any) => (
          <div key={draft.id} className="p-5 card-midas rounded-2xl space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-thistle-100 text-royal-800 border border-gold-500/35">
                {draft.tone} ({draft.useCase}{draft.stepNumber ? ` #${draft.stepNumber}` : ''})
              </span>
              {canEdit && (
                <div className="flex gap-3 text-xs font-bold">
                  <button onClick={() => onEditDraft(draft)} className="text-royal-700 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => onDeleteDraft(draft.id)} className="text-rose-600 hover:underline">
                    Delete
                  </button>
                </div>
              )}
            </div>

            <h4 className="text-sm font-bold text-royal-950">{draft.subject}</h4>
            <p className="text-xs text-royal-950/75 whitespace-pre-wrap font-sans line-clamp-4">{draft.body}</p>

            <div className="p-2.5 bg-thistle-50/80 border border-gold-500/35 rounded-xl flex items-center justify-between text-[11px] text-thistle-500">
              <div>Sent: <strong className="text-royal-950">{draft.sentCount || 0}</strong></div>
              <div>Opens: <strong className="text-royal-700">{draft.openCount || 0} ({draft.openRate || 0}%)</strong></div>
              <div>Clicks: <strong className="text-royal-600">{draft.clickCount || 0} ({draft.clickRate || 0}%)</strong></div>
              <div>Replies: <strong className="text-emerald-700">{draft.replyCount || 0} ({draft.replyRate || 0}%)</strong></div>
            </div>

            <div className="space-y-3 pt-3 border-t border-gold-500/30">
              <DeliverabilityGrader
                campaignId={campaignId}
                subject={draft.subject}
                body={draft.body}
              />
              <SpintaxSimulator subject={draft.subject} body={draft.body} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};