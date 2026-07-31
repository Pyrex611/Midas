import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  campaignName: string;
}

export const DeleteCampaignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  campaignName,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== campaignName) return;
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handled in parent
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Campaign</h3>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{campaignName}</strong>? This action cannot be undone.
        </p>
        <p className="text-sm text-gray-600 mb-4">Type the campaign name to confirm:</p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 mb-4"
          placeholder={campaignName}
        />
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== campaignName}
            className="px-4 py-2 bg-red-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};