import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface CampaignHeaderProps {
  campaign: any;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  canEdit: boolean;
  canDelete: boolean;
  onUploadLeadsClick: () => void;
  onInviteClick: () => void;
  onTogglePauseResume: () => void;
  onReconcileQueue: () => void;
  onRepersonalizeQueue: () => void;
  onRenameClick: () => void;
  onStrategyClick: () => void;
  onDeleteClick: () => void;
  isReconciling: boolean;
  isRepersonalizing: boolean;
}

export const CampaignHeader: React.FC<CampaignHeaderProps> = ({
  campaign,
  role,
  canEdit,
  canDelete,
  onUploadLeadsClick,
  onInviteClick,
  onTogglePauseResume,
  onReconcileQueue,
  onRepersonalizeQueue,
  onRenameClick,
  onStrategyClick,
  onDeleteClick,
  isReconciling,
  isRepersonalizing,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <Link to="/campaigns" className="text-xs font-bold text-zinc-400 hover:text-zinc-700 flex items-center gap-1 mb-1">
          ← Campaigns
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">{campaign.name}</h1>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              campaign.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700'
                : campaign.status === 'PAUSED'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {campaign.status}
          </span>
          {role === 'VIEWER' && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">
              👁 View-Only Access
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60">
          {campaign.queuedCount || 0} In Queue
        </span>

        {canEdit && (
          <button
            onClick={onUploadLeadsClick}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>+ Upload Leads</span>
          </button>
        )}

        {canEdit && (
          <button
            onClick={onInviteClick}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>👥 Invite</span>
          </button>
        )}

        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
              title="Campaign Actions"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onTogglePauseResume();
                  }}
                  className="block w-full text-left px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 border-b border-zinc-100"
                >
                  {campaign.status === 'PAUSED' ? '▶ Resume Campaign' : '⏸ Pause Campaign'}
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onReconcileQueue();
                  }}
                  disabled={isReconciling}
                  className="block w-full text-left px-4 py-2 text-xs font-medium text-blue-600 hover:bg-zinc-50"
                >
                  {isReconciling ? 'Reconciling...' : '⚡ Reconcile & Queue Leads'}
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRepersonalizeQueue();
                  }}
                  disabled={isRepersonalizing}
                  className="block w-full text-left px-4 py-2 text-xs font-medium text-amber-700 hover:bg-zinc-50"
                >
                  {isRepersonalizing ? 'Refreshing...' : '🔄 Refresh Queue from Copy Reserves'}
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRenameClick();
                  }}
                  className="block w-full text-left px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Rename Campaign
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onStrategyClick();
                  }}
                  className="block w-full text-left px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Refine SDR Strategy
                </button>
                {canDelete && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteClick();
                    }}
                    className="block w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    Delete Campaign
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};