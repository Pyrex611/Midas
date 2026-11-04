import React from 'react';
import { DeliverabilityGrader } from '../DeliverabilityGrader';
import { SpintaxSimulator } from '../SpintaxSimulator';

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
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Copywriting Variations ({drafts.length})</h3>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={onGenerateAiDraft}
              disabled={generatingDraft}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
            >
              {generatingDraft ? 'Synthesizing...' : '✨ Generate AI Variation'}
            </button>
            <button
              onClick={onOpenCustomDraftModal}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              + Custom Draft
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {drafts.map((draft: any) => (
          <div key={draft.id} className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {draft.tone} ({draft.useCase}{draft.stepNumber ? ` #${draft.stepNumber}` : ''})
              </span>
              {canEdit && (
                <div className="flex gap-3 text-xs font-bold">
                  <button onClick={() => onEditDraft(draft)} className="text-blue-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => onDeleteDraft(draft.id)} className="text-rose-600 hover:underline">
                    Delete
                  </button>
                </div>
              )}
            </div>

            <h4 className="text-sm font-bold text-zinc-900">{draft.subject}</h4>
            <p className="text-xs text-zinc-600 whitespace-pre-wrap font-sans line-clamp-4">{draft.body}</p>

            {/* Per-Draft Real Analytics Display */}
            <div className="p-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between text-[11px] text-zinc-600">
              <div>Sent: <strong className="text-zinc-900">{draft.sentCount || 0}</strong></div>
              <div>Opens: <strong className="text-blue-700">{draft.openCount || 0} ({draft.openRate || 0}%)</strong></div>
              <div>Clicks: <strong className="text-purple-700">{draft.clickCount || 0} ({draft.clickRate || 0}%)</strong></div>
              <div>Replies: <strong className="text-emerald-700">{draft.replyCount || 0} ({draft.replyRate || 0}%)</strong></div>
            </div>

            <div className="space-y-3 pt-3 border-t border-zinc-100">
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