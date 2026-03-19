import React, { useState, useEffect } from 'react';
import { campaignAPI, aiAPI } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialLeadIds?: string[];
  defaultSenderName?: string;
}

export const CreateCampaignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  initialLeadIds,
  defaultSenderName,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState(''); // Part of Phase 4.5d
  const [context, setContext] = useState('');
  const [reference, setReference] = useState('');
  const [senderName, setSenderName] = useState(defaultSenderName || '');
  
  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // --- Optimization State Logic ---
  const [originalContext, setOriginalContext] = useState('');
  const [isOptimized, setIsOptimized] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setObjective('');
      setContext('');
      setReference('');
      setOriginalContext('');
      setIsOptimized(false);
      setSenderName(defaultSenderName || '');
    }
  }, [isOpen, defaultSenderName]);

  const handleOptimize = async () => {
    if (!context.trim()) return;
    setOriginalContext(context); // Save user input
    setOptimizing(true);
    try {
      const res = await aiAPI.optimizeContext(context);
      setContext(res.data.optimized);
      setIsOptimized(true);
    } catch (error) {
      console.error('Failed to optimize context', error);
      alert('Could not optimize context. Please try again.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleRevert = () => {
    setContext(originalContext);
    setIsOptimized(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await campaignAPI.create({
        name,
        description,
        objective,
        context,
        reference,
        senderName,
        leadIds: initialLeadIds,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create campaign', error);
      alert('Could not create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Campaign</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Q1 Outreach – Software Engineers"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of this campaign"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Objective <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Book a 15-minute discovery call"
              required
            />
          </div>

          <div className="mb-4 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Goal / Context <span className="text-gray-500 text-xs">(Crucial for AI drafting)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => {
                setContext(e.target.value);
                if (isOptimized) setIsOptimized(false);
              }}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Propose my services as a senior software engineer, emphasize value I can add to their team."
              required
            />
            
            <div className="absolute right-2 top-8">
              {!isOptimized ? (
                <button
                  type="button"
                  onClick={handleOptimize}
                  disabled={optimizing || !context.trim()}
                  className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 transition-all"
                >
                  {optimizing ? 'Optimizing...' : '✨ Optimize'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRevert}
                  className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-all"
                >
                  ↩ Revert
                </button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Story / Past Client (Optional)
            </label>
            <textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., I helped ACME Corp increase sales by 30%..."
            />
            <p className="mt-1 text-xs text-gray-500">
              If provided, the AI may reference this story using the placeholder {'{{reference_company}}'}.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Name (Optional)
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., John Doe"
            />
          </div>

          {initialLeadIds && initialLeadIds.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
              This campaign will start immediately with {initialLeadIds.length} lead(s).
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};