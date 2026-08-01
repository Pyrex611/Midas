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

export const LeadEmailPreviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  campaignId,
  lead,
  onSendSuccess,
}) => {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [replyDraft, setReplyDraft] = useState<any | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadThread = async () => {
    if (!isOpen || !lead) return;
    setLoadingThread(true);
    try {
      const [threadRes, draftRes] = await Promise.all([
        campaignAPI.getLeadThread(campaignId, lead.id),
        campaignAPI.getReplyDraft(campaignId, lead.id).catch(() => null)
      ]);
      setThread(threadRes.data);
      if (draftRes && draftRes.data) {
        setReplyDraft(draftRes.data);
      } else {
        setReplyDraft(null);
      }
    } catch (err) {
      setError('Failed to load conversation thread');
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (isOpen && lead) {
      campaignAPI.getDrafts(campaignId)
        .then(res => setDrafts(res.data))
        .catch(() => setError('Failed to load drafts'));
      loadThread();
    }
  }, [isOpen, campaignId, lead]);

  const handleRefresh = async () => {
    await loadThread();
  };

  const handleGenerateReply = async () => {
    if (!lead) return;
    setGeneratingReply(true);
    try {
      const res = await campaignAPI.generateReplyDraft(campaignId, lead.id);
      setReplyDraft(res.data);
    } catch (err: any) {
      setError('Failed to generate reply draft');
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyDraft || !lead) return;
    setSending(true);
    try {
      await campaignAPI.sendReplyDraft(campaignId, lead.id, {
        subject: replyDraft.subject,
        body: replyDraft.body,
      });
      await loadThread();
      setReplyDraft(null);
      if (onSendSuccess) onSendSuccess();
    } catch (err: any) {
      setError('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-medium text-gray-900">{lead.name} – Conversation</h3>
          <div className="flex items-center space-x-2">
            <button onClick={handleRefresh} className="p-2 rounded-full hover:bg-gray-200" title="Refresh Thread">
              🔄
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        {loadingThread ? (
          <div className="py-8 text-center text-gray-500">Loading conversation thread...</div>
        ) : (
          <div className="space-y-4 mb-6">
            {thread.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isIncoming ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${msg.isIncoming ? 'bg-white border' : 'bg-blue-50 border border-blue-200'}`}>
                  <div className="text-xs text-gray-500 mb-1">{new Date(msg.sentAt).toLocaleString()}</div>
                  <div className="text-sm font-medium">{msg.subject}</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap">{msg.body}</div>
                </div>
              </div>
            ))}

            {!replyDraft && (
              <div className="flex justify-center mt-4">
                <button onClick={handleGenerateReply} disabled={generatingReply} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  {generatingReply ? 'Generating...' : 'Generate AI Reply'}
                </button>
              </div>
            )}

            {replyDraft && (
              <div className="bg-blue-100 p-4 rounded-lg border border-blue-300 mt-4">
                <h4 className="font-bold text-blue-900 text-sm mb-2">Suggested Reply Draft</h4>
                <p className="text-sm font-semibold">{replyDraft.subject}</p>
                <p className="text-sm whitespace-pre-wrap mt-1">{replyDraft.body}</p>
                <div className="mt-3 flex justify-end">
                  <button onClick={handleSendReply} disabled={sending} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};