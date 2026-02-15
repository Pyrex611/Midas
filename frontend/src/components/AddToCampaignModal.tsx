import React, { useState } from 'react';
import { campaignAPI } from '../services/api';
import { CreateCampaignModal } from './CreateCampaignModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  leadIds: string[];
  availableCampaigns: any[];
  onSuccess: (campaignId: string) => void;
  onRefresh?: () => void; // Optional callback to refresh parent list
}

export const AddToCampaignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  leadIds,
  availableCampaigns,
  onSuccess,
  onRefresh,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [localCampaigns, setLocalCampaigns] = useState(availableCampaigns);

  // Sync with prop when it changes
  React.useEffect(() => {
    setLocalCampaigns(availableCampaigns);
  }, [availableCampaigns]);

  const handleAddToExisting = async () => {
    if (!selectedCampaignId) return;
    setAdding(true);
    try {
      await campaignAPI.addLeads(selectedCampaignId, leadIds);
      onSuccess(selectedCampaignId);
      onClose();
    } catch (error) {
      console.error('Failed to add leads to campaign', error);
      alert('Could not add leads to campaign');
    } finally {
      setAdding(false);
    }
  };

  const refreshCampaigns = async () => {
    try {
      const res = await campaignAPI.getAll();
      setLocalCampaigns(res.data);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to refresh campaigns', error);
    }
  };

  const handleCreateSuccess = async () => {
    setShowCreateModal(false);
    await refreshCampaigns(); // ✅ Refresh dropdown with new campaign
    // Optionally auto-select the newly created campaign?
    // For now, just refresh; user can select manually.
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add to Outreach Campaign</h3>
          <p className="text-sm text-gray-600 mb-4">
            {leadIds.length} lead(s) selected. Choose a campaign or create a new one.
          </p>

          {localCampaigns.length > 0 ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select existing campaign
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
            <p className="text-sm text-yellow-600 mb-4">No campaigns found. Create one below.</p>
          )}

          <div className="flex flex-col space-y-3">
            {localCampaigns.length > 0 && (
              <button
                onClick={handleAddToExisting}
                disabled={!selectedCampaignId || adding}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add to Selected Campaign'}
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              + Create New Campaign
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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