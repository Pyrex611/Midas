import React, { useState } from 'react';
import { campaignAPI } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaign: any;
  onSuccess: () => void;
}

export const EditStrategyModal: React.FC<Props> = ({ isOpen, onClose, campaign, onSuccess }) => {
  const [objective, setObjective] = useState(campaign.objective || '');
  const [targetTool, setTargetTool] = useState(campaign.targetTool || '');
  const [extendedObjective, setExtendedObjective] = useState(campaign.extendedObjective || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await campaignAPI.updateStrategy(campaign.id, {
        objective,
        targetTool,
        extendedObjective
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Failed to update strategy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-8">
        <h3 className="text-xl font-black mb-6">Refine Campaign Strategy</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Global Objective</label>
            <input 
              className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Book a discovery call"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Conversion Tool (Phone/Link)</label>
            <input 
              className="w-full p-3 bg-blue-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-blue-700 font-bold"
              value={targetTool}
              onChange={(e) => setTargetTool(e.target.value)}
              placeholder="e.g. +1 (400)XXXXXXXX or Calendly link"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Extended SDR Instructions</label>
            <textarea 
              className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-sm"
              rows={4}
              value={extendedObjective}
              onChange={(e) => setExtendedObjective(e.target.value)}
              placeholder="Explain the nuance of how the AI should talk to leads..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 font-bold">Cancel</button>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-gray-900 text-white font-black rounded-xl disabled:opacity-50">
              {submitting ? 'Updating...' : 'Save Strategy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};