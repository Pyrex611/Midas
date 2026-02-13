import React, { useEffect, useState } from 'react';
import { campaignAPI } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  lead: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export const LeadEmailPreviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  campaignId,
  lead,
}) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && lead) {
      setLoading(true);
      setError(null);
      campaignAPI
        .getLeadEmailPreview(campaignId, lead.id)
        .then((res) => setPreview(res.data))
        .catch((err) =>
          setError(err.response?.data?.error || 'Failed to load preview')
        )
        .finally(() => setLoading(false));
    }
  }, [isOpen, campaignId, lead]);

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Email Preview – {lead.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">
              Personalising email draft...
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To:
              </label>
              <div className="bg-gray-50 p-2 rounded text-sm">{lead.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject:
              </label>
              <div className="bg-gray-50 p-2 rounded text-sm font-medium">
                {preview.subject}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Body:
              </label>
              <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap font-mono">
                {preview.body}
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-700">
              This is a preview of the personalised email that will be sent.
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};