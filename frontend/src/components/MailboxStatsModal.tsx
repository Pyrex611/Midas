import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mailbox: any;
}

export const MailboxStatsModal: React.FC<Props> = ({ isOpen, onClose, mailbox }) => {
  if (!isOpen || !mailbox) return null;

  const calculateRate = (part: number, total: number) => {
    if (!total || total === 0) return '0.0';
    return ((part / total) * 100).toFixed(1);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{mailbox.name}</h2>
              <p className="text-sm text-gray-500">{mailbox.email}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Main Stats Card */}
            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
              <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Lifetime Emails Sent</p>
              <h3 className="text-4xl font-black">{mailbox.totalSent || 0}</h3>
              <div className="mt-4 flex gap-4">
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-bold">Replies</p>
                  <p className="text-lg font-bold">{mailbox.replyCount || 0}</p>
                </div>
                <div className="border-l border-blue-400/30 pl-4">
                  <p className="text-[10px] text-blue-200 uppercase font-bold">Bounces</p>
                  <p className="text-lg font-bold">{mailbox.bounceCount || 0}</p>
                </div>
              </div>
            </div>

            {/* Performance Indicators */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Reply Rate</p>
                <p className="text-2xl font-black text-blue-600">{calculateRate(mailbox.replyCount, mailbox.totalSent)}%</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Bounce Rate</p>
                <p className={`text-2xl font-black ${Number(calculateRate(mailbox.bounceCount, mailbox.totalSent)) > 5 ? 'text-red-500' : 'text-gray-700'}`}>
                  {calculateRate(mailbox.bounceCount, mailbox.totalSent)}%
                </p>
              </div>
            </div>

            {/* Health Status */}
            <div className={`p-4 rounded-2xl flex items-center gap-3 ${mailbox.status === 'HEALTHY' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
               <div className={`w-3 h-3 rounded-full ${mailbox.status === 'HEALTHY' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
               <div>
                 <p className="text-xs font-bold text-gray-800 uppercase tracking-tighter">System Status: {mailbox.status || 'HEALTHY'}</p>
                 {mailbox.lastError && <p className="text-[10px] text-red-600 font-mono mt-1 leading-tight">{mailbox.lastError}</p>}
               </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full mt-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Close Insights
          </button>
        </div>
      </div>
    </div>
  );
};