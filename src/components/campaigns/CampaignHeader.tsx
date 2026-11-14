import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icons } from '../../lib/icons';

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
        <Link
          to="/campaigns"
          className="text-xs font-bold text-thistle-500 hover:text-royal-800 flex items-center gap-1 mb-1 transition-colors"
        >
          <Icons.ChevronLeft />
          <span>Campaigns</span>
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-royal-950 tracking-tight">{campaign.name}</h1>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              campaign.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : campaign.status === 'PAUSED'
                ? 'bg-amber-50 text-amber-800 border-gold-400/50'
                : 'bg-thistle-100 text-royal-800 border-thistle-300'
            }`}
          >
            {campaign.status}
          </span>
          {role === 'VIEWER' && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-thistle-100 text-royal-700 border border-gold-500/35 flex items-center gap-1">
              <Icons.Eye className="text-[12px]" />
              <span>View-Only Access</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          {campaign.queuedCount || 0} In Queue
        </span>

        {canEdit && (
          <button
            onClick={onUploadLeadsClick}
            className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.Plus className="text-gold-300" />
            <span>Upload Leads</span>
          </button>
        )}

        {canEdit && (
          <button
            onClick={onInviteClick}
            className="px-3.5 py-1.5 bg-white hover:bg-thistle-100 text-royal-800 border border-gold-500/40 rounded-xl text-xs font-bold glow-gold-hover flex items-center gap-1.5"
          >
            <Icons.Users className="text-gold-600" />
            <span>Invite</span>
          </button>
        )}

        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl border border-gold-500/40 bg-white hover:bg-thistle-50 text-royal-800 glow-gold-hover"
              title="Campaign Actions"
            >
              <Icons.Settings />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gold-500/45 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onTogglePauseResume();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-royal-950 hover:bg-thistle-50 border-b border-gold-500/30 flex items-center gap-2"
                >
                  <Icons.Bolt className="text-gold-600" />
                  <span>{campaign.status === 'PAUSED' ? 'Resume Campaign' : 'Pause Campaign'}</span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onReconcileQueue();
                  }}
                  disabled={isReconciling}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-royal-700 hover:bg-thistle-50 flex items-center gap-2"
                >
                  <Icons.Bolt className="text-gold-600" />
                  <span>{isReconciling ? 'Reconciling...' : 'Reconcile & Queue Leads'}</span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRepersonalizeQueue();
                  }}
                  disabled={isRepersonalizing}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-amber-800 hover:bg-thistle-50 border-b border-gold-500/25 flex items-center gap-2"
                >
                  <Icons.Refresh className="text-gold-600" />
                  <span>{isRepersonalizing ? 'Refreshing...' : 'Refresh Queue from Reserves'}</span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRenameClick();
                  }}
                  className="block w-full text-left px-4 py-2 text-xs font-medium text-royal-950 hover:bg-thistle-50"
                >
                  Rename Campaign
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onStrategyClick();
                  }}
                  className="block w-full text-left px-4 py-2 text-xs font-medium text-royal-950 hover:bg-thistle-50"
                >
                  Refine SDR Strategy
                </button>
                {canDelete && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteClick();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border-t border-gold-500/25 flex items-center gap-2 mt-1"
                  >
                    <Icons.Trash />
                    <span>Delete Campaign</span>
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