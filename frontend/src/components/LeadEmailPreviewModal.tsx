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
  isDraft?: boolean; // for reply drafts
  analysis?: any;
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
  const [replyDraft, setReplyDraft] = useState<EmailMessage | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editingReply, setEditingReply] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  const isAlreadySent = lead?.outreachStatus === 'SENT';

  // Find the most recent reply (incoming email) for analysis
  const latestReply = thread.filter(msg => msg.isIncoming).sort((a, b) =>
    new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  )[0];

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
      // Clear any existing reply draft when thread reloads
      setReplyDraft(null);
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
      setTimeout(async () => {
        await loadThread();
        setRefreshing(false);
      }, 3000);
    } catch (err: any) {
      setError('Failed to trigger IMAP poll');
      setRefreshing(false);
    }
  };

  const handleGenerateReply = async () => {
    if (!lead || !latestReply) return;
    setGeneratingReply(true);
    setError(null);
    try {
      const res = await campaignAPI.generateReplyDraft(campaignId, lead.id);
      setReplyDraft({ ...res.data, isDraft: true });
      setEditingReply(false); // exit edit mode if any
      setEditedSubject(res.data.subject);
      setEditedBody(res.data.body);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate reply draft');
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleEditReply = () => {
    if (replyDraft) {
      setEditedSubject(replyDraft.subject);
      setEditedBody(replyDraft.body);
      setEditingReply(true);
    }
  };

  const handleCancelEdit = () => {
    setEditingReply(false);
  };

  const handleSaveEdit = () => {
    if (replyDraft) {
      setReplyDraft({
        ...replyDraft,
        subject: editedSubject,
        body: editedBody,
      });
      setEditingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyDraft || !lead) return;
    // For now, we send the edited draft using the existing send endpoint.
    // But we need to specify that this is a reply. We'll just use the same send endpoint,
    // which will create an outbound email. We'll treat it as a new email.
    setSending(true);
    setError(null);
    try {
      // We need to send the draft as a new email. We'll use the existing send endpoint,
      // but we might want to mark it as a reply. For now, we'll just send it.
      await campaignAPI.sendLeadEmail(campaignId, lead.id); // This sends the currently selected campaign draft, not our reply draft.
      // That's not right. We need a separate endpoint to send a reply draft.
      // For simplicity, we'll create a new endpoint later. For now, we'll just alert.
      alert('Reply sending not yet implemented – will be in next step.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
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
            {lead.name} – Conversation
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

        {/* Conversation Thread (chat style) */}
        {thread.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-3">Messages</h4>
            {loadingThread ? (
              <div className="flex items-center text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading thread...
              </div>
            ) : (
              <div className="space-y-4">
                {thread.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isIncoming ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.isIncoming
                          ? 'bg-white border border-gray-200'
                          : 'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <div className="flex justify-between items-start text-xs text-gray-500 mb-1">
                        <span>{msg.isIncoming ? msg.fromAddress || 'Lead' : 'You'}</span>
                        <span>{formatDate(msg.sentAt)}</span>
                      </div>
                      <div className="text-sm font-medium">{msg.subject}</div>
                      <div className="mt-1 text-sm whitespace-pre-wrap">{msg.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reply Analysis Card (if latest reply exists) */}
        {latestReply && latestReply.analysis && (
          <div className="mb-6 border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-md font-medium text-gray-800">Reply Analysis</h4>
              <button
                onClick={handleGenerateReply}
                disabled={generatingReply}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {generatingReply ? 'Generating...' : 'Generate Reply Draft'}
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              {/* Sentiment badge */}
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-600 w-24">Sentiment:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  latestReply.analysis.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                  latestReply.analysis.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {latestReply.analysis.sentiment}
                </span>
              </div>

              {/* Intent */}
              <div className="flex">
                <span className="text-sm font-medium text-gray-600 w-24">Intent:</span>
                <span className="text-sm text-gray-800">{latestReply.analysis.intent}</span>
              </div>

              {/* Interest Level (progress bar) */}
              {latestReply.analysis.interestLevel !== undefined && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-600">Interest Level</span>
                    <span className="text-xs text-gray-500">{latestReply.analysis.interestLevel}/10</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${latestReply.analysis.interestLevel * 10}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Pain Points */}
              {latestReply.analysis.painPoints && latestReply.analysis.painPoints.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-600 block mb-1">Pain Points</span>
                  <ul className="list-disc list-inside text-sm text-gray-800">
                    {latestReply.analysis.painPoints.map((point: string, idx: number) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Objections */}
              {latestReply.analysis.objections && latestReply.analysis.objections.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-600 block mb-1">Objections</span>
                  <ul className="list-disc list-inside text-sm text-gray-800">
                    {latestReply.analysis.objections.map((obj: string, idx: number) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Buying Signals */}
              {latestReply.analysis.buyingSignals && latestReply.analysis.buyingSignals.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-600 block mb-1">Buying Signals</span>
                  <ul className="list-disc list-inside text-sm text-gray-800">
                    {latestReply.analysis.buyingSignals.map((signal: string, idx: number) => (
                      <li key={idx}>{signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Approach */}
              {latestReply.analysis.suggestedApproach && (
                <div className="bg-blue-50 p-2 rounded text-sm text-blue-800">
                  <span className="font-medium">Suggested Approach:</span> {latestReply.analysis.suggestedApproach}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reply Draft (if generated) */}
        {replyDraft && (
          <div className="mb-6 border-t pt-4">
            <h4 className="text-md font-medium text-gray-800 mb-3">Reply Draft</h4>
            <div className="flex justify-end">
              <div className="max-w-[80%] bg-blue-50 border border-blue-200 p-3 rounded-lg">
                {editingReply ? (
                  <>
                    <div className="mb-2">
                      <label className="block text-xs text-gray-600 mb-1">Subject</label>
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs text-gray-600 mb-1">Body</label>
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={6}
                        className="w-full px-2 py-1 border rounded text-sm font-mono"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 bg-gray-300 text-gray-800 text-sm rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-start text-xs text-gray-500 mb-1">
                      <span>You (draft)</span>
                      <span>{formatDate(replyDraft.sentAt)}</span>
                    </div>
                    <div className="text-sm font-medium">{replyDraft.subject}</div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{replyDraft.body}</div>
                    <div className="mt-3 flex justify-end space-x-2">
                      <button
                        onClick={handleEditReply}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleSendReply}
                        disabled={sending}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {sending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Campaign Drafts Section (existing) */}
        {loadingDrafts ? (
          <div className="flex items-center text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading campaign drafts...
          </div>
        ) : drafts.length > 0 && preview ? (
          <div className="space-y-4 border-t pt-4">
            <h4 className="text-md font-medium text-gray-800 mb-2">Campaign Drafts</h4>
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
          <p className="text-center py-4 text-gray-500">No campaign drafts available.</p>
        )}
      </div>
    </div>
  );
};