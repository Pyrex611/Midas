import React, { useEffect, useState } from 'react';
import { inboxAPI } from '../services/api';

export const Inbox: React.FC = () => {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchInbox = async () => {
    try {
      const res = await inboxAPI.getThreads();
      setThreads(res.data);
      if (res.data.length > 0 && !activeThreadId) {
        setActiveThreadId(res.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load inbox', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendReply = async () => {
    if (!replyBody.trim() || !activeThreadId) return;
    setSending(true);
    
    // Optimistically update thread view for immediate feedback
    const activeLead = threads.find(t => t.id === activeThreadId);
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      subject: activeLead?.sentEmails?.[activeLead.sentEmails.length - 1]?.subject || 'Re: Outreach',
      body: replyBody,
      sentAt: new Date().toISOString(),
      isIncoming: false,
    };

    setThreads(prev =>
      prev.map(t =>
        t.id === activeThreadId
          ? { ...t, sentEmails: [...(t.sentEmails || []), optimisticMessage] }
          : t
      )
    );

    const bodyToSend = replyBody;
    setReplyBody('');

    try {
      await inboxAPI.sendReply(activeThreadId, bodyToSend);
      await fetchInbox();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send reply');
      await fetchInbox();
    } finally {
      setSending(false);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  const getSentimentBadge = (analysisStr: string) => {
    if (!analysisStr) return null;
    try {
      const analysis = typeof analysisStr === 'string' ? JSON.parse(analysisStr) : analysisStr;
      const s = analysis.sentiment;
      const colors: any = {
        'very positive': 'bg-green-600 text-white',
        'positive': 'bg-green-400 text-white',
        'neutral': 'bg-yellow-400 text-white',
        'negative': 'bg-red-400 text-white',
        'very negative': 'bg-red-600 text-white',
      };
      return <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${colors[s] || 'bg-gray-200 text-gray-800'}`}>{s}</span>;
    } catch (e) { return null; }
  };

  if (loading) return <div className="pt-24 text-center">Loading Inbox...</div>;

  return (
    <div className="h-screen pt-16 flex flex-col bg-gray-50">
      <div className="max-w-7xl w-full mx-auto flex-1 flex overflow-hidden py-6 px-4">
        
        {/* Left Pane: Thread List */}
        <div className="w-1/3 border-r bg-white rounded-l-lg shadow flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">Unified Inbox</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No replies recorded yet.</div>
            ) : (
              threads.map(thread => {
                const latestEmail = thread.sentEmails?.[thread.sentEmails.length - 1];
                return (
                  <div 
                    key={thread.id} 
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`p-4 border-b cursor-pointer transition-colors ${activeThreadId === thread.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-gray-900 truncate">{thread.name}</span>
                      <span className="text-xs text-gray-500">
                        {latestEmail ? new Date(latestEmail.sentAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <div className="text-xs text-blue-600 mb-1 truncate">{thread.campaign?.name}</div>
                    <div className="text-sm text-gray-600 truncate mb-2">{latestEmail?.subject || 'No subject'}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 truncate w-2/3">{latestEmail?.body || ''}</span>
                      {latestEmail?.isIncoming && getSentimentBadge(latestEmail.analysis)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Thread */}
        <div className="flex-1 bg-white rounded-r-lg shadow flex flex-col relative">
          {activeThread ? (
            <>
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{activeThread.name} <span className="text-sm font-normal text-gray-500">({activeThread.email})</span></h2>
                  <p className="text-xs text-gray-500">{activeThread.company || 'No company'} | {activeThread.position || 'No position'}</p>
                </div>
              </div>

              {/* Conversation History */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                {(activeThread.sentEmails || []).map((msg: any) => {
                  const isIncoming = msg.isIncoming;
                  let analysis = null;
                  if (msg.analysis) {
                    try { analysis = typeof msg.analysis === 'string' ? JSON.parse(msg.analysis) : msg.analysis; } catch(e){}
                  }

                  return (
                    <div key={msg.id} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] p-4 rounded-lg shadow-sm ${isIncoming ? 'bg-white border border-gray-200' : 'bg-blue-600 text-white'}`}>
                        <div className={`flex justify-between items-center mb-2 pb-2 border-b ${isIncoming ? 'border-gray-100' : 'border-blue-500'}`}>
                          <span className="text-xs font-bold">{isIncoming ? msg.fromAddress || activeThread.name : 'You'}</span>
                          <span className={`text-xs ${isIncoming ? 'text-gray-400' : 'text-blue-200'}`}>
                            {new Date(msg.sentAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm font-semibold mb-1">{msg.subject}</div>
                        <div className={`text-sm whitespace-pre-wrap font-sans ${isIncoming ? 'text-gray-800' : 'text-blue-50'}`}>
                          {msg.body}
                        </div>
                        
                        {/* AI Insights on inbound replies */}
                        {isIncoming && analysis && (
                          <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-gray-500">AI Insight:</span>
                              {getSentimentBadge(msg.analysis)}
                            </div>
                            {analysis.intent && <div className="text-xs text-gray-600"><span className="font-semibold">Intent:</span> {analysis.intent}</div>}
                            {analysis.painPoints?.length > 0 && <div className="text-xs text-red-600 mt-1"><span className="font-semibold">Pain Points:</span> {analysis.painPoints.join(', ')}</div>}
                            {analysis.suggestedApproach && <div className="text-xs text-blue-600 mt-1 bg-blue-50 p-2 rounded"><span className="font-semibold">Suggested Action:</span> {analysis.suggestedApproach}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div className="p-4 border-t bg-white">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Draft your reply..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
                ></textarea>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSendReply}
                    disabled={sending || !replyBody.trim()}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a thread to view the conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
};