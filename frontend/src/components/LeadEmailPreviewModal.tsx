import React, { useEffect, useState } from 'react';
import { campaignAPI, imapAPI } from '../services/api';

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

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  isIncoming: boolean;
  fromAddress?: string;
  toAddress?: string;
  status: string;
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
  const [thread, setThread] = useState<EmailMessage[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isAlreadySent = lead?.outreachStatus === 'SENT';

  // Fetch all drafts for this campaign
  useEffect(() => {
    if (isOpen && lead) {
      setLoadingDrafts(true);
      setError(null);
      campaignAPI.getDrafts(campaignId)
        .then(res => setDrafts(res.data))
        .catch(err => setError('Failed to load drafts'))
        .finally(() => setLoadingDrafts(false));
    }
  }, [isOpen, campaignId, lead]);

  // Fetch conversation thread
  const loadThread = async () => {
    if (!isOpen || !lead) return;
    setLoadingThread(true);
    try {
      const res = await campaignAPI.getLeadThread(campaignId, lead.id);
      setThread(res.data);
    } catch (err) {
      setError('Failed to load conversation thread');
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    loadThread();
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
      // Refresh thread after sending
      await loadThread();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await imapAPI.poll();
      // Wait a bit for backend to process, then reload thread
      setTimeout(async () => {
        await loadThread();
        setRefreshing(false);
      }, 3000);
    } catch (err: any) {
      setError('Failed to trigger IMAP poll');
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 pb-2 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Lead Interaction – {lead.name}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
              title="Check for new replies"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
        )}

        {/* Conversation Thread (only if there are emails) */}
        {thread.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-2">Conversation</h4>
            {loadingThread ? (
              <div className="flex items-center text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading thread...
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                {thread.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.isIncoming
                        ? 'bg-white border border-gray-200 ml-4'
                        : 'bg-blue-50 border border-blue-200 mr-4'
                    }`}
                  >
                    <div className="flex justify-between items-start text-xs text-gray-500 mb-1">
                      <span>{msg.isIncoming ? `📥 From: ${msg.fromAddress || 'unknown'}` : '📤 Sent to lead'}</span>
                      <span>{formatDate(msg.sentAt)}</span>
                    </div>
                    <div className="text-sm font-medium">{msg.subject}</div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{msg.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Draft Preview */}
        {loadingDrafts ? (
          <div className="flex items-center text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading drafts...
          </div>
        ) : drafts.length > 0 && preview ? (
          <div className="space-y-4 border-t pt-4">
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

            {/* Draft selector */}
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

            {/* Send button */}
            <div className="flex items-center justify-between pt-4">
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
        ) : (
          <p className="text-center py-4 text-gray-500">No drafts available for this campaign.</p>
        )}
      </div>
    </div>
  );
};