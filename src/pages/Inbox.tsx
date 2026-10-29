import React, { useEffect, useState } from 'react';
import { inboxAPI, senderAPI, leadAPI } from '../services/api';
import { Sheet } from '../components/common/Sheet';
import { useToast } from '../context/ToastContext';

export const Inbox: React.FC = () => {
  const { toast } = useToast();
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<'ALL' | 'POSITIVE' | 'OBJECTION'>('ALL');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Conversation State
  const [isNewConvoOpen, setIsNewConvoOpen] = useState(false);
  const [convoMode, setConvoMode] = useState<'SELECT_LEAD' | 'MANUAL_ENTRY'>('SELECT_LEAD');
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [availableSenders, setAvailableSenders] = useState<any[]>([]);
  
  // Form fields
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
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    fetchInbox();
    loadSendersAndLeads();
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

      // Reset form
      setConvoSubject('');
      setConvoBody('');
      setRecipientEmail('');
      setRecipientName('');
      setRecipientCompany('');
      setRecipientPosition('');
      setSelectedLeadId('');
      setIsNewConvoOpen(false);

      // Re-fetch and auto-select thread
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
      {/* COLUMN 1: THREAD LIST & ACTIONS */}
      <div className="w-80 md:w-96 bg-white border-r border-zinc-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-zinc-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-zinc-900 tracking-tight">Unified Inbox</h2>
            {/* + NEW CONVERSATION BUTTON */}
            <button
              onClick={() => setIsNewConvoOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>+ New Conversation</span>
            </button>
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

        {/* Scrollable Threads */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-400">Loading replies...</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No conversations active. Click "+ New Conversation" to reach out to a prospect.
            </div>
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
                  <p className="text-[11px] font-medium text-blue-600 truncate">{thread.campaign?.name || 'Direct Outreach'}</p>
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
            <div className="h-16 px-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">{activeThread.name}</h3>
                <p className="text-[11px] text-zinc-400 font-mono">{activeThread.email} · {activeThread.company || 'Direct Contact'}</p>
              </div>
            </div>

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
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-zinc-900">No conversation selected</h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Select an active thread from the left, or compose a new email to an existing or new prospect.
            </p>
            <button
              onClick={() => setIsNewConvoOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Start New Conversation
            </button>
          </div>
        )}
      </div>

      {/* 
        SLIDE-OVER SHEET: NEW CONVERSATION COMPOSER
        Prompts user to select from existing leads or enter recipient information,
        asks whether to add to leads, and dispatches via selected mailbox sender.
      */}
      <Sheet
        isOpen={isNewConvoOpen}
        onClose={() => setIsNewConvoOpen(false)}
        title="Compose New Conversation"
        description="Initiate direct outreach from any of your authenticated mailbox senders."
        width="lg"
      >
        <form onSubmit={handleStartNewConversation} className="space-y-4">
          {/* Recipient Source Mode Selector */}
          <div className="flex p-1 bg-zinc-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setConvoMode('SELECT_LEAD')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                convoMode === 'SELECT_LEAD' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Select Existing Lead
            </button>
            <button
              type="button"
              onClick={() => setConvoMode('MANUAL_ENTRY')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                convoMode === 'MANUAL_ENTRY' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              New Recipient Info
            </button>
          </div>

          {/* Mode 1: Select Existing Lead */}
          {convoMode === 'SELECT_LEAD' ? (
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Target Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
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
            /* Mode 2: Manual Recipient Input */
            <div className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Sarah Chen"
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Recipient Email *</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="sarah@company.com"
                    required={convoMode === 'MANUAL_ENTRY'}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Company</label>
                  <input
                    type="text"
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Position / Role</label>
                  <input
                    type="text"
                    value={recipientPosition}
                    onChange={(e) => setRecipientPosition(e.target.value)}
                    placeholder="VP of Growth"
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* ASKS IF TO ADD RECIPIENT TO LEADS */}
              <div className="pt-2 border-t border-zinc-200 flex items-center gap-2">
                <input
                  id="save-as-lead-checkbox"
                  type="checkbox"
                  checked={saveAsLead}
                  onChange={(e) => setSaveAsLead(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-0"
                />
                <label htmlFor="save-as-lead-checkbox" className="text-xs font-bold text-zinc-700 cursor-pointer">
                  Save this recipient to my Leads database
                </label>
              </div>
            </div>
          )}

          {/* Mailbox Sender Selector */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Send From Mailbox (Sender)</label>
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
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

          {/* Subject */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Subject</label>
            <input
              type="text"
              value={convoSubject}
              onChange={(e) => setConvoSubject(e.target.value)}
              placeholder="Quick question regarding your growth goals"
              required
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Email Body</label>
            <textarea
              rows={8}
              value={convoBody}
              onChange={(e) => setConvoBody(e.target.value)}
              placeholder="Write your email message here..."
              required
              className="w-full p-3 border border-zinc-200 rounded-xl text-xs font-sans focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewConvoOpen(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={startingConvo || availableSenders.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs transition-colors"
            >
              {startingConvo ? 'Dispatching...' : 'Send Email'}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};