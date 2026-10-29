import React, { useEffect, useState } from 'react';
import { inboxAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export const Inbox: React.FC = () => {
  const { toast } = useToast();
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<'ALL' | 'POSITIVE' | 'OBJECTION' | 'OOO'>('ALL');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchInbox = async () => {
    try {
      const res = await inboxAPI.getThreads();
      const list = res.data || [];
      setThreads(list);
      if (list.length > 0 && !activeThreadId) {
        setActiveThreadId(list[0].id);
      }
    } catch {
      toast.error('Failed to load incoming replies', 'Network Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 20000);
    return () => clearInterval(interval);
  }, []);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  const handleSendReply = async () => {
    if (!replyBody.trim() || !activeThreadId) return;
    setSending(true);

    const activeLead = activeThread;
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      subject: activeLead?.sentEmails?.[activeLead.sentEmails.length - 1]?.subject || 'Re: Outreach',
      body: replyBody,
      sentAt: new Date().toISOString(),
      isIncoming: false,
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId ? { ...t, sentEmails: [...(t.sentEmails || []), optimisticMessage] } : t
      )
    );

    const bodyToSend = replyBody;
    setReplyBody('');

    try {
      await inboxAPI.sendReply(activeThreadId, bodyToSend);
      toast.success('Reply dispatched to prospect', 'Sent');
      await fetchInbox();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch reply', 'Error');
      await fetchInbox();
    } finally {
      setSending(false);
    }
  };

  const getSentimentPill = (analysisStr: string) => {
    if (!analysisStr) return null;
    try {
      const analysis = typeof analysisStr === 'string' ? JSON.parse(analysisStr) : analysisStr;
      const s = (analysis.sentiment || '').toLowerCase();
      if (s.includes('positive')) {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700">POSITIVE</span>;
      }
      if (s.includes('negative')) {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700">OBJECTION</span>;
      }
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-100 text-zinc-600">NEUTRAL</span>;
    } catch {
      return null;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex bg-zinc-50 overflow-hidden">
      {/* COLUMN 1: THREAD LIST & SENTIMENT FILTER */}
      <div className="w-80 md:w-96 bg-white border-r border-zinc-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-zinc-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-zinc-900 tracking-tight">Unified Inbox</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
              {threads.length} Active
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {(['ALL', 'POSITIVE', 'OBJECTION'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterSentiment(tab)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  filterSentiment === tab ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Thread Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-400">Loading replies...</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">No conversations recorded yet.</div>
          ) : (
            threads.map((thread) => {
              const latest = thread.sentEmails?.[thread.sentEmails.length - 1];
              const isSelected = activeThreadId === thread.id;

              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`p-4 cursor-pointer transition-colors text-left space-y-1 ${
                    isSelected ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 truncate">{thread.name}</span>
                    <span className="text-[10px] text-zinc-400">
                      {latest?.sentAt ? new Date(latest.sentAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-blue-600 truncate">{thread.campaign?.name || 'Sequence'}</p>
                  <p className="text-xs text-zinc-600 truncate opacity-90">{latest?.body || 'No text'}</p>
                  <div className="pt-1">{latest?.isIncoming && getSentimentPill(latest.analysis)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 2: ACTIVE CONVERSATION CANVAS */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {activeThread ? (
          <>
            {/* Thread Header */}
            <div className="h-16 px-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">{activeThread.name}</h3>
                <p className="text-[11px] text-zinc-400 font-mono">{activeThread.email} · {activeThread.company || 'Direct Contact'}</p>
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50">
              {(activeThread.sentEmails || []).map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.isIncoming ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[75%] p-4 rounded-2xl shadow-xs text-xs space-y-1 ${
                      msg.isIncoming
                        ? 'bg-white border border-zinc-200 text-zinc-900'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-75 pb-1 border-b border-current/10">
                      <span className="font-bold">{msg.isIncoming ? activeThread.name : 'You'}</span>
                      <span>{new Date(msg.sentAt).toLocaleString()}</span>
                    </div>
                    <p className="font-bold text-[11px] pt-1">{msg.subject}</p>
                    <p className="whitespace-pre-wrap leading-relaxed opacity-95">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Reply Tray */}
            <div className="p-4 border-t border-zinc-200 bg-white space-y-2 flex-shrink-0">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Draft your reply (Cmd + Enter to dispatch)..."
                rows={3}
                className="w-full p-3 border border-zinc-200 rounded-xl text-xs font-sans focus:outline-none focus:border-blue-500 resize-none"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleSendReply();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyBody.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 shadow-xs transition-colors"
                >
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-400">
            Select a conversation thread to inspect messages.
          </div>
        )}
      </div>
    </div>
  );
};