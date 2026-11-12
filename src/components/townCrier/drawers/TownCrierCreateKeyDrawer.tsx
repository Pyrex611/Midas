import React, { useState } from 'react';
import { Sheet } from '../../common/Sheet';
import { townCrierAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

interface TownCrierCreateKeyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyCreated: (key: string) => void;
}

export const TownCrierCreateKeyDrawer: React.FC<TownCrierCreateKeyDrawerProps> = ({
  isOpen,
  onClose,
  onKeyCreated,
}) => {
  const { toast } = useToast();
  const [keyLabel, setKeyLabel] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim()) return;

    setCreatingKey(true);
    try {
      const res = await townCrierAPI.createApiKey(keyLabel.trim());
      onKeyCreated(res.data.plaintextKey);
      setKeyLabel('');
      onClose();
      toast.success('API Key generated successfully', 'Key Provisioned');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not generate API Key'), 'Error');
    } finally {
      setCreatingKey(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Provision Town Crier API Key"
      description="Generate a secret key to ingest newsletter subscribers from external websites or blogs."
      width="md"
    >
      <form onSubmit={handleCreateApiKey} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Key Label</label>
          <input
            type="text"
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder="e.g. Website Blog Footer Form"
            required
            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creatingKey}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs"
          >
            {creatingKey ? 'Generating...' : 'Generate Key'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};