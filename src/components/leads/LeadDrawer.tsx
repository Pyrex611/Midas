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
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [replyDraft, setReplyDraft] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  // Scheduled Email Edit State
  const [editingScheduledId, setEditingScheduledId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [savingScheduled, setSavingScheduled] = useState(false);
  const [sendingNowId, setSendingNowId] = useState<string | null>(null);

  const activeCampaignId = campaignId || lead?.campaignId || undefined;

  const loadData = () => {
    if (!isOpen || !lead || !activeCampaignId) return;

    setLoading(true);
    Promise.all([
      campaignAPI.getLeadThread(activeCampaignId, lead.id),
      campaignAPI.getReplyDraft(activeCampaignId, lead.id).catch(() => null),
    ])
      .then(([threadRes, draftRes]) => {
        setThread(threadRes.data?.emails || []);
        setScheduledEmails(threadRes.data?.scheduled || []);
        setReplyDraft(draftRes?.data || null);
      })
      .catch(() => {
        toast.error('Failed to load conversation history', 'Network Error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [isOpen, lead, activeCampaignId]);

  const handleStartEditScheduled = (item: any) => {
    setEditingScheduledId(item.id);
    setEditSubject(item.rawSubject);
    setEditBody(item.rawBody);
  };

  const handleSaveScheduled = async (pendingId: string) => {
    if (!editSubject.trim() || !editBody.trim() || !activeCampaignId) return;

    setSavingScheduled(true);
    try {
      await campaignAPI.updateScheduledEmail(activeCampaignId, pendingId, {
        subject: editSubject.trim(),
        body: editBody.trim(),
      });
      toast.success('Scheduled email updated and variables preserved', 'Saved');
      setEditingScheduledId(null);
      loadData();
    } catch {
      toast.error('Could not save scheduled email', 'Error');
    } finally {
      setSavingScheduled(false);
    }
  };

  const handleSendNow = async (pendingId: string) => {
    if (!activeCampaignId) return;
    setSendingNowId(pendingId);
    try {
      await campaignAPI.sendScheduledEmailNow(activeCampaignId, pendingId);
      toast.success('Email dispatched immediately (pause bypassed)', 'Sent');
      loadData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch email', 'Send Error');
    } finally {
      setSendingNowId(null);
    }
  };

  const handleGenerateReply = async () => {
    if (!lead || !activeCampaignId) return;
    setGenerating(true);
    try {
      const res = await campaignAPI.generateReplyDraft(activeCampaignId, lead.id);
      setReplyDraft(res.data);
      toast.success('AI reply drafted successfully', 'Copilot');
    } catch {
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
      loadData();
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
        {/* Attributes */}
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

        {/* 1. UPCOMING SCHEDULED MESSAGES (With Resolved View, In-Place Edit & Send Now) */}
        {scheduledEmails.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Scheduled Dispatch ({scheduledEmails.length})
              </span>
              <span className="text-[10px] text-zinc-400">Waiting in queue</span>
            </div>

            {scheduledEmails.map((item) => {
              const isEditing = editingScheduledId === item.id;
              const isSending = sendingNowId === item.id;

              return (
                <div key={item.id} className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/50">
                    <span className="font-bold text-amber-900 text-[11px]">
                      {isEditing ? 'Editing Raw Template (Mustache Mode)' : 'Resolved Live Preview (As Sent)'}
                    </span>

                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => handleStartEditScheduled(item)}
                            className="px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-700 font-bold rounded-lg border border-zinc-200 text-[10px] transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleSendNow(item.id)}
                            disabled={isSending}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] transition-colors disabled:opacity-50 shadow-2xs"
                          >
                            {isSending ? 'Sending...' : 'Send Now ✈'}
                          </button>
                        </>
                      ) : (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setEditingScheduledId(null)}
                            className="px-2.5 py-1 text-zinc-500 hover:text-zinc-800 text-[10px]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveScheduled(item.id)}
                            disabled={savingScheduled}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] disabled:opacity-50"
                          >
                            {savingScheduled ? 'Saving...' : 'Save & Resolve'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Content: Either Raw Mustache when editing, or Resolved Preview when viewing */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Subject</label>
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Body Text</label>
                        <textarea
                          rows={6}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-bold text-zinc-900">{item.resolvedSubject}</p>
                      <p className="whitespace-pre-wrap leading-relaxed text-zinc-700 opacity-95">{item.resolvedBody}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 2. PAST CONVERSATION STREAM */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Conversation Stream</h3>
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">Loading conversation history...</div>
          ) : thread.length === 0 && scheduledEmails.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-500">
              No emails sent or queued yet for this lead.
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

        {/* 3. AI REPLY COPILOT */}
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