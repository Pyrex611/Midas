import React, { useEffect, useState } from 'react';
import { Sheet } from '../common/Sheet';
import { campaignAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Lead } from '../../types/lead';

interface LeadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  campaignId?: string;
  onUpdate?: () => void;
}

export const LeadDrawer: React.FC<LeadDrawerProps> = ({
  isOpen,
  onClose,
  lead,
  campaignId,
  onUpdate,
}) => {
  const { toast } = useToast();
  const [thread, setThread] = useState<any[]>([]);
  const [replyDraft, setReplyDraft] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const activeCampaignId = campaignId || lead?.campaignId || undefined;

  useEffect(() => {
    if (!isOpen || !lead || !activeCampaignId) return;

    setLoading(true);
    Promise.all([
      campaignAPI.getLeadThread(activeCampaignId, lead.id),
      campaignAPI.getReplyDraft(activeCampaignId, lead.id).catch(() => null),
    ])
      .then(([threadRes, draftRes]) => {
        setThread(threadRes.data || []);
        setReplyDraft(draftRes?.data || null);
      })
      .catch(() => {
        toast.error('Failed to load conversation history', 'Network Error');
      })
      .finally(() => setLoading(false));
  }, [isOpen, lead, activeCampaignId]);

  const handleGenerateReply = async () => {
    if (!lead || !activeCampaignId) return;
    setGenerating(true);
    try {
      const res = await campaignAPI.generateReplyDraft(activeCampaignId, lead.id);
      setReplyDraft(res.data);
      toast.success('AI reply drafted successfully', 'Copilot');
    } catch (err: any) {
      toast.error('Could not generate AI reply draft', 'Error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendReply = async () => {
    if (!lead || !activeCampaignId || !replyDraft) return;
    setSending(true);
    try {
      await campaignAPI.sendReplyDraft(activeCampaignId, lead.id, {
        subject: replyDraft.subject,
        body: replyDraft.body,
      });
      toast.success(`Reply sent to ${lead.email}`, 'Dispatched');
      setReplyDraft(null);
      // Reload thread
      const threadRes = await campaignAPI.getLeadThread(activeCampaignId, lead.id);
      setThread(threadRes.data || []);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch reply', 'Send Error');
    } finally {
      setSending(false);
    }
  };

  if (!lead) return null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={lead.name}
      description={`${lead.email} · ${lead.company || 'No Company'} · ${lead.position || 'No Title'}`}
      width="xl"
    >
      <div className="space-y-6">
        {/* Quick Attribute Pills */}
        <div className="flex flex-wrap gap-2 pb-4 border-b border-zinc-100">
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 text-zinc-800">
            Status: {lead.status}
          </span>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700">
            Outreach: {lead.outreachStatus || 'UNCONTACTED'}
          </span>
          {lead.verificationStatus && (
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
              lead.verificationStatus === 'VALID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {lead.verificationStatus}
            </span>
          )}
        </div>

        {/* Conversation Thread */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Conversation Stream</h3>
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">Loading conversation history...</div>
          ) : thread.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-500">
              No outbound or inbound emails recorded yet for this lead.
            </div>
          ) : (
            <div className="space-y-3">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl text-xs space-y-1.5 ${
                    msg.isIncoming
                      ? 'bg-zinc-100/80 border border-zinc-200 text-zinc-900 mr-6'
                      : 'bg-blue-600 text-white ml-6 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between opacity-75 text-[10px]">
                    <span className="font-bold">{msg.isIncoming ? 'Prospect Reply' : 'Outbound Dispatch'}</span>
                    <span>{new Date(msg.sentAt).toLocaleString()}</span>
                  </div>
                  <p className="font-bold">{msg.subject}</p>
                  <p className="whitespace-pre-wrap leading-relaxed opacity-95">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Reply Copilot Box */}
        {activeCampaignId && (
          <div className="pt-4 border-t border-zinc-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">AI Response Copilot</span>
              {!replyDraft && (
                <button
                  onClick={handleGenerateReply}
                  disabled={generating}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {generating ? 'Drafting...' : '✨ Generate Smart Reply'}
                </button>
              )}
            </div>

            {replyDraft && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-blue-600">Subject</p>
                  <p className="text-xs font-semibold text-zinc-900">{replyDraft.subject}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-blue-600">Body</p>
                  <p className="text-xs text-zinc-800 whitespace-pre-wrap">{replyDraft.body}</p>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-blue-200/60">
                  <button
                    onClick={() => setReplyDraft(null)}
                    className="px-3 py-1 text-xs text-zinc-600 hover:text-zinc-900"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSendReply}
                    disabled={sending}
                    className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Approve & Send Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
};