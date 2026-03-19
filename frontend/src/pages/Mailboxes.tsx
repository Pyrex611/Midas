import React, { useEffect, useState } from 'react';
import { mailboxAPI } from '../services/api';
import { MailboxForm } from '../components/MailboxForm';
import { MailboxStatsModal } from '../components/MailboxStatsModal';

export const Mailboxes: React.FC = () => {
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedForStats, setSelectedForStats] = useState<any>(null);

  const fetchMailboxes = async () => {
    try {
      const res = await mailboxAPI.getAll();
      console.log("Frontend Received Mailboxes:", res.data); // 👈 DEBUG
      setMailboxes(res.data);
    } catch (err) {
      console.error('Failed to load mailboxes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMailboxes();
  }, []);

  const handleCardClick = (mb: any) => {
    console.log("Card Clicked for:", mb.email); // 👈 PROVE CLICKABILITY
    setSelectedForStats(mb);
  };

  if (loading) return <div className="pt-32 text-center font-bold">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-24 pb-32 relative z-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900">Mailbox Personas</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="relative z-20 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg transition-all"
        >
          + Add Mailbox
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {mailboxes.map((mb) => (
          <div 
            key={mb.id} 
            className="relative z-10 bg-white border-2 border-gray-100 rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer pointer-events-auto overflow-hidden group"
						onClick={() => {
							console.log("Forcing Stats Modal for:", mb.email);
							setSelectedForStats(mb);
						}}
          >
            {/* Interaction Layer Hint */}
            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-5 transition-opacity" />

            <div className="flex justify-between items-start mb-6">
              <div className="min-w-0">
                <h3 className="font-black text-xl text-gray-900 truncate">{mb.name}</h3>
                <p className="text-sm text-gray-500 truncate font-medium">{mb.email}</p>
              </div>
              <div className={`w-3 h-3 rounded-full shadow-sm ${mb.status === 'HEALTHY' ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>

            {/* Quick Stats Summary */}
            <div className="flex gap-4 mb-6">
               <div className="bg-gray-50 rounded-xl px-3 py-2">
                 <p className="text-[10px] text-gray-400 font-bold uppercase">Sent</p>
                 <p className="text-sm font-black text-gray-700">{mb.totalSent || 0}</p>
               </div>
               <div className="bg-blue-50 rounded-xl px-3 py-2">
                 <p className="text-[10px] text-blue-400 font-bold uppercase">Replies</p>
                 <p className="text-sm font-black text-blue-600">{mb.replyCount || 0}</p>
               </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
               <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                 Analytics Details →
               </span>
               <div className="flex gap-4" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => { setEditing(mb); setShowForm(true); }}
                    className="text-xs font-bold text-gray-400 hover:text-blue-600 uppercase"
                  >
                    Edit
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Modal */}
      <MailboxStatsModal 
        isOpen={!!selectedForStats} 
        onClose={() => setSelectedForStats(null)} 
        mailbox={selectedForStats} 
      />

      {/* Form Modal */}
      {showForm && (
        <MailboxForm
          mailbox={editing}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchMailboxes(); }}
        />
      )}
    </div>
  );
};