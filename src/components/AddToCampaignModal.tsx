import React, { useState, useEffect } from 'react';
import { campaignAPI, getErrorMessage } from '../services/api';
import { CreateCampaignModal } from './CreateCampaignModal';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  leadIds: string[];
  availableCampaigns: any[];
  onSuccess: (campaignId: string) => void;
  onRefresh?: () => void;
}

export const AddToCampaignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  leadIds,
  availableCampaigns,
  onSuccess,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [localCampaigns, setLocalCampaigns] = useState(availableCampaigns);

  useEffect(() => {
    setLocalCampaigns(availableCampaigns);
  }, [availableCampaigns]);

  const handleAddToExisting = async () => {
    if (!selectedCampaignId) return;
    setAdding(true);
    try {
      await campaignAPI.addLeads(selectedCampaignId, leadIds);
      onSuccess(selectedCampaignId);
      onClose();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Could not add leads to campaign'), 'Error');
    } finally {
      setAdding(false);
    }
  };

  const refreshCampaigns = async () => {
    try {
      const res = await campaignAPI.getAll();
      setLocalCampaigns(res.data || []);
      if (onRefresh) onRefresh();
    } catch {}
  };

  const handleCreateSuccess = async () => {
    setShowCreateModal(false);
    await refreshCampaigns();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full max-w-md bg-white border border-gold-500/45 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-gold-500/35">
            <h3 className="text-base font-black text-royal-950">Add to Outreach Campaign</h3>
            <button onClick={onClose} className="text-thistle-500 hover:text-royal-950 p-1">
              <Icons.Close />
            </button>
          </div>

          <p className="text-xs text-royal-950/75 mb-4">
            <strong>{leadIds.length}</strong> lead(s) selected. Choose an active sequence or create a new campaign.
          </p>

          {localCampaigns.length > 0 ? (
            <div className="mb-4">
              <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1.5">
                Select Existing Campaign
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-semibold text-royal-950 focus:outline-none focus:border-gold-500"
              >
                <option value="">-- Choose a campaign --</option>
                {localCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status}) – {c._count?.leads || 0} leads
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-amber-800 bg-amber-50 border border-gold-400/50 rounded-xl p-3 mb-4">
              No campaigns found. Create a new sequence below.
            </p>
          )}

          <div className="flex flex-col space-y-2.5 pt-2 border-t border-gold-500/35">
            {localCampaigns.length > 0 && (
              <button
                onClick={handleAddToExisting}
                disabled={!selectedCampaignId || adding}
                className="w-full px-4 py-2 btn-royal rounded-xl text-xs font-bold"
              >
                {adding ? 'Adding...' : 'Add to Selected Campaign'}
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full px-4 py-2 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/40 text-royal-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Icons.Plus className="text-gold-600" />
              <span>Create New Campaign</span>
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-xs font-bold text-thistle-500 hover:text-royal-950"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        initialLeadIds={leadIds}
      />
    </>
  );
};