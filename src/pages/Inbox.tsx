import React, { useEffect, useState } from 'react';
import { inboxAPI, senderAPI, leadAPI } from '../services/api';
import { Sheet } from '../components/common/Sheet';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

export const Inbox: React.FC = () => {
  const { toast } = useToast();
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<'ALL' | 'POSITIVE' | 'OBJECTION'>('ALL');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isNewConvoOpen, setIsNewConvoOpen] = useState(false);
  const [convoMode, setConvoMode] = useState<'SELECT_LEAD' | 'MANUAL_ENTRY'>('SELECT_LEAD');
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [availableSenders, setAvailableSenders] = useState<any[]>([]);

  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientPosition, setRecipientPosition] = useState('');
  const [saveAsLead, setSaveAsLead] = useState(true);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [convoSubject, setConvoSubject] = useState('');
  const [convoBody, setConvoBody] = useState('');
  const [startingConvo, setStartingConvo] = useState(false);

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

  const loadSendersAndLeads = async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        senderAPI.listAll(),
        leadAPI.getAll(1, 100),
      ]);
      const activeSenders = (sRes.data || []).filter((s: any) => s.status === 'active' && s.domain?.status === 'active');
      setAvailableSenders(activeSenders);
      if (activeSenders.length > 0) setSelectedSenderId(activeSenders[0].id);
      setAvailableLeads(lRes.data?.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchInbox();
    loadSendersAndLeads();
    const interval = setInterval(fetchInbox, 20000);
    return () => clearInterval(interval);
  }, []);

  const filteredThreads = threads.filter((t) => {
    if (filterSentiment === 'ALL') return true;
    const latest = t.sentEmails?.[t.sentEmails.length - 1];
    if (!latest?.analysis) return false;
    try {
      const parsed = typeof latest.analysis === 'string' ? JSON.parse(latest.analysis) : latest.analysis;
      const s = (parsed.sentiment || '').toLowerCase();
      if (filterSentiment === 'POSITIVE') return s.includes('positive');
      if (filterSentiment === 'OBJECTION') return s.includes('negative');
    } catch {}
    return true;
  });

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

  const handleStartNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSenderId) {
      return toast.warning('Please select an active sending mailbox', 'Validation');
    }
    if (!convoSubject.trim() || !convoBody.trim()) {
      return toast.warning('Subject and email body are required', 'Validation');
    }
    if (convoMode === 'SELECT_LEAD' && !selectedLeadId) {
      return toast.warning('Please select a lead to email', 'Validation');
    }
    if (convoMode === 'MANUAL_ENTRY' && (!recipientEmail.trim() || !recipientEmail.includes('@'))) {
      return toast.warning('Please provide a valid recipient email address', 'Validation');
    }

    setStartingConvo(true);
    try {
      const payload: any = {
        senderId: selectedSenderId,
        subject: convoSubject.trim(),
        body: convoBody.trim(),
      };

      if (convoMode === 'SELECT_LEAD') {
        payload.leadId = selectedLeadId;
      } else {
        payload.name = recipientName.trim();
        payload.email = recipientEmail.trim();
        payload.company = recipientCompany.trim();
        payload.position = recipientPosition.trim();
        payload.saveAsLead = saveAsLead;
      }

      const res = await inboxAPI.startConversation(payload);
      toast.success(`Direct conversation dispatched to ${res.data?.lead?.email}`, 'Dispatched');

      setConvoSubject('');
      setConvoBody('');
      setRecipientEmail('');
      setRecipientName('');
      setRecipientCompany('');
      setRecipientPosition('');
      setSelectedLeadId('');
      setIsNewConvoOpen(false);

      await fetchInbox();
      if (res.data?.lead?.id) {
        setActiveThreadId(res.data.lead.id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not start conversation', 'Send Error');
    } finally {
      setStartingConvo(false);
    }
  };

  const getSentimentPill = (analysisStr: string) => {
    if (!analysisStr) return null;
    try {
      const analysis = typeof analysisStr === 'string' ? JSON.parse(analysisStr) : analysisStr;
      const s = (analysis.sentiment || '').toLowerCase();
      if (s.includes('positive')) {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">POSITIVE</span>;
      }
      if (s.includes('negative')) {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">OBJECTION</span>;
      }
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-thistle-100 text-royal-700 border border-thistle-300">NEUTRAL</span>;
    } catch {
      return null;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex bg-thistle-canvas overflow-hidden">
      {/* COLUMN 1: THREAD LIST */}
      <div className="w-80 md:w-96 bg-white border-r border-gold-500/40 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gold-500/35 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-royal-950 tracking-tight">Unified Inbox</h2>
            <button
              onClick={() => setIsNewConvoOpen(true)}
              className="px-3 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Icons.Plus className="text-gold-300" />
              <span>New Conversation</span>
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(['ALL', 'POSITIVE', 'OBJECTION'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterSentiment(tab)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors border ${
                  filterSentiment === tab
                    ? 'bg-royal-700 text-white border-gold-400/50'
                    : 'bg-thistle-50 text-royal-800 border-gold-500/30 hover:bg-thistle-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gold-500/25">
          {loading ? (
            <div className="p-8 text-center text-xs text-thistle-500">Loading replies...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-xs text-thistle-500">
              No conversations active. Click "+ New Conversation" to reach out to a prospect.
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const latest = thread.sentEmails?.[thread.sentEmails.length - 1];
              const isSelected = activeThreadId === thread.id;

              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`p-4 cursor-pointer transition-colors text-left space-y-1 ${
                    isSelected ? 'bg-thistle-100/80 border-l-4 border-l-gold-500' : 'hover:bg-thistle-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-royal-950 truncate">{thread.name}</span>
                    <span className="text-[10px] text-thistle-500">
                      {latest?.sentAt ? new Date(latest.sentAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-royal-700 truncate">{thread.campaign?.name || 'Direct Outreach'}</p>
                  <p className="text-xs text-royal-950/70 truncate">{latest?.body || 'No text'}</p>
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
            <div className="h-16 px-6 border-b border-gold-500/35 flex items-center justify-between bg-thistle-50/70 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-royal-950">{activeThread.name}</h3>
                <p className="text-[11px] text-thistle-500 font-mono">
                  {activeThread.email} · {activeThread.company || 'Direct Contact'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-thistle-canvas/60">
              {(activeThread.sentEmails || []).map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.isIncoming ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[75%] p-4 rounded-2xl shadow-xs text-xs space-y-1 ${
                      msg.isIncoming
                        ? 'bg-white border border-gold-500/40 text-royal-950'
                        : 'bg-royal-700 text-white border border-gold-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-80 pb-1 border-b border-gold-500/30">
                      <span className="font-bold">{msg.isIncoming ? activeThread.name : 'You'}</span>
                      <span>{new Date(msg.sentAt).toLocaleString()}</span>
                    </div>
                    <p className="font-bold text-[11px] pt-1">{msg.subject}</p>
                    <p className="whitespace-pre-wrap leading-relaxed opacity-95">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gold-500/40 bg-white space-y-2 flex-shrink-0">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Draft your reply (Cmd + Enter to dispatch)..."
                rows={3}
                className="w-full p-3 border border-gold-500/35 bg-thistle-50/40 rounded-xl text-xs font-sans text-royal-950 focus:outline-none focus:border-gold-500 resize-none"
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
                  className="px-5 py-2 btn-royal text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Icons.Send className="text-gold-300" />
                  <span>{sending ? 'Sending...' : 'Send Reply'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-thistle-canvas/40">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gold-500/40 text-royal-700 flex items-center justify-center shadow-xs">
              <Icons.Inbox className="text-xl text-gold-600" />
            </div>
            <h3 className="text-base font-bold text-royal-950">No conversation selected</h3>
            <p className="text-xs text-thistle-500 max-w-sm">
              Select an active thread from the left, or compose a new email to an existing or new prospect.
            </p>
            <button
              onClick={() => setIsNewConvoOpen(true)}
              className="px-4 py-2 btn-royal text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Icons.Plus className="text-gold-300" />
              <span>Start New Conversation</span>
            </button>
          </div>
        )}
      </div>

      {/* SLIDE-OVER SHEET: NEW CONVERSATION COMPOSER */}
      <Sheet
        isOpen={isNewConvoOpen}
        onClose={() => setIsNewConvoOpen(false)}
        title="Compose New Conversation"
        description="Initiate direct outreach from any of your authenticated mailbox senders."
        width="lg"
      >
        <form onSubmit={handleStartNewConversation} className="space-y-4">
          <div className="flex p-1 bg-thistle-100 border border-gold-500/30 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setConvoMode('SELECT_LEAD')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                convoMode === 'SELECT_LEAD' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800 hover:bg-white/60'
              }`}
            >
              Select Existing Lead
            </button>
            <button
              type="button"
              onClick={() => setConvoMode('MANUAL_ENTRY')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                convoMode === 'MANUAL_ENTRY' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800 hover:bg-white/60'
              }`}
            >
              New Recipient Info
            </button>
          </div>

          {convoMode === 'SELECT_LEAD' ? (
            <div>
              <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Target Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full px-3 py-2 border border-gold-500/35 rounded-xl text-xs font-medium focus:outline-none focus:border-gold-500"
                required={convoMode === 'SELECT_LEAD'}
              >
                <option value="">-- Choose a lead from your database --</option>
                {availableLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.email}) {l.company ? `· ${l.company}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-thistle-50 border border-gold-500/35 rounded-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Sarah Chen"
                    className="w-full px-3 py-2 bg-white border border-gold-500/30 rounded-xl text-xs focus:outline-none focus:border-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Recipient Email *</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="sarah@company.com"
                    required={convoMode === 'MANUAL_ENTRY'}
                    className="w-full px-3 py-2 bg-white border border-gold-500/30 rounded-xl text-xs font-mono focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Company</label>
                  <input
                    type="text"
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 bg-white border border-gold-500/30 rounded-xl text-xs focus:outline-none focus:border-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Position / Role</label>
                  <input
                    type="text"
                    value={recipientPosition}
                    onChange={(e) => setRecipientPosition(e.target.value)}
                    placeholder="VP of Growth"
                    className="w-full px-3 py-2 bg-white border border-gold-500/30 rounded-xl text-xs focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gold-500/30 flex items-center gap-2">
                <input
                  id="save-as-lead-checkbox"
                  type="checkbox"
                  checked={saveAsLead}
                  onChange={(e) => setSaveAsLead(e.target.checked)}
                  className="rounded border-thistle-400 text-royal-700 focus:ring-0"
                />
                <label htmlFor="save-as-lead-checkbox" className="text-xs font-bold text-royal-950 cursor-pointer">
                  Save this recipient to my Leads database
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Send From Mailbox (Sender)</label>
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="w-full px-3 py-2 border border-gold-500/35 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-gold-500"
              required
            >
              {availableSenders.length === 0 ? (
                <option value="">No active senders available (check Domains)</option>
              ) : (
                availableSenders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.localPart}@{s.domain?.domainName} ({s.sentCountToday}/{s.dailyLimit} today)
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Subject</label>
            <input
              type="text"
              value={convoSubject}
              onChange={(e) => setConvoSubject(e.target.value)}
              placeholder="Quick question regarding your growth goals"
              required
              className="w-full px-3 py-2 border border-gold-500/35 rounded-xl text-xs font-medium focus:outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Email Body</label>
            <textarea
              rows={8}
              value={convoBody}
              onChange={(e) => setConvoBody(e.target.value)}
              placeholder="Write your email message here..."
              required
              className="w-full p-3 border border-gold-500/35 rounded-xl text-xs font-sans focus:outline-none focus:border-gold-500 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-gold-500/35 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewConvoOpen(false)}
              className="px-4 py-2 text-xs font-bold text-thistle-500 hover:text-royal-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={startingConvo || availableSenders.length === 0}
              className="px-5 py-2 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Icons.Send className="text-gold-300" />
              <span>{startingConvo ? 'Dispatching...' : 'Send Email'}</span>
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};