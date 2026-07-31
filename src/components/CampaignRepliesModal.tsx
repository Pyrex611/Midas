import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  leads: any[];
  onSelectLead: (lead: any) => void;
}

export const CampaignRepliesModal: React.FC<Props> = ({ isOpen, onClose, leads, onSelectLead }) => {
  if (!isOpen) return null;

  const repliedLeads = leads.filter(l => l.status === 'REPLIED');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-xl font-black text-gray-900">Campaign Replies</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{repliedLeads.length} Leads Engaged</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {repliedLeads.length === 0 ? (
            <div className="py-20 text-center text-gray-400 italic">No replies recorded for this campaign yet.</div>
          ) : (
            <div className="space-y-3">
              {repliedLeads.map((lead) => {
                const firstEmail = lead.sentEmails?.[0];
                return (
                  <div 
                    key={lead.id} 
                    onClick={() => onSelectLead(lead)}
                    className="group bg-white border-2 border-gray-50 rounded-2xl p-4 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{lead.name}</h4>
                      <p className="text-xs text-gray-500 mb-2">{lead.email}</p>
                      
                      <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Sender:</span>
                          <span className="text-[10px] font-black text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {firstEmail?.mailbox?.email || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Started:</span>
                          <span className="text-[10px] font-black text-gray-700">
                            {firstEmail ? new Date(firstEmail.sentAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-blue-500 font-black text-xl group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};