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
    outreachStatus?: string;
  } | null;
  onSendSuccess?: () => void;
}

interface Draft {
  id: string;
  subject: string;
  body: string;
  tone: string;
  useCase: string;
}

export const LeadEmailPreviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  campaignId,
  lead,
  onSendSuccess,
}) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isAlreadySent = lead?.outreachStatus === 'SENT';

  // Fetch all drafts for this campaign
  useEffect(() => {
    if (isOpen && lead) {
      setLoading(true);
      setError(null);
      campaignAPI.getDrafts(campaignId)
        .then(res => setDrafts(res.data))
        .catch(err => setError('Failed to load drafts'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, campaignId, lead]);

  // Fetch preview for current draft index
  useEffect(() => {
    if (drafts.length > 0 && lead) {
      const draftId = drafts[currentDraftIndex].id;
      campaignAPI.previewLeadWithDraft(campaignId, lead.id, draftId)
        .then(res => setPreview(res.data))
        .catch(err => setError('Failed to load preview'));
    }
  }, [drafts, currentDraftIndex, campaignId, lead]);

  const handlePrev = () => {
    setCurrentDraftIndex(prev => (prev > 0 ? prev - 1 : drafts.length - 1));
  };

  const handleNext = () => {
    setCurrentDraftIndex(prev => (prev < drafts.length - 1 ? prev + 1 : 0));
  };

  const handleSend = async () => {
    if (!lead || drafts.length === 0) return;
    setSending(true);
    setError(null);
    try {
      await campaignAPI.sendLeadEmail(campaignId, lead.id);
      if (onSendSuccess) onSendSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Email Preview – {lead.name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading drafts...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
        )}

        {drafts.length > 0 && preview && (
          <div className="space-y-4">
            {/* Draft selector with arrows */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
              <button
                onClick={handlePrev}
                className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-30"
                disabled={drafts.length <= 1}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium">
                Draft {currentDraftIndex + 1} of {drafts.length} ({drafts[currentDraftIndex].tone} tone)
              </span>
              <button
                onClick={handleNext}
                className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-30"
                disabled={drafts.length <= 1}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Email preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
              <div className="bg-gray-50 p-2 rounded text-sm">{lead.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
              <div className="bg-gray-50 p-2 rounded text-sm font-medium">{preview.subject}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body:</label>
              <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap font-mono">
                {preview.body}
              </div>
            </div>

            {/* Send button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-xs text-gray-500">
                {isAlreadySent ? (
                  <span className="text-green-600 font-medium">✓ Outreach Already Sent</span>
                ) : (
                  <span>This email has not been sent yet.</span>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={sending || isAlreadySent}
                className={`px-6 py-2 rounded-md text-white font-medium flex items-center ${
                  sending || isAlreadySent
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : isAlreadySent ? (
                  '✓ Already Sent'
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {!loading && drafts.length === 0 && (
          <p className="text-center py-8 text-gray-500">No drafts available for this campaign.</p>
        )}
      </div>
    </div>
  );
};