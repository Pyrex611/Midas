import React, { useState } from 'react';
import { Lead, LeadStatus, OutreachStatus } from '../types/lead';

const statusColors: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  FOLLOW_UP: 'bg-orange-100 text-orange-800',
  REPLIED: 'bg-green-100 text-green-800',
  UNSUBSCRIBED: 'bg-gray-100 text-gray-800',
  BOUNCED: 'bg-red-100 text-red-800',
};

interface Props {
  leads: Lead[];
  onDelete: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkCampaign?: (ids: string[]) => void;
  showOutreachStatus?: boolean;
  campaignStatus?: any;
}

export const LeadsTable: React.FC<Props> = ({
  leads,
  onDelete,
  onBulkDelete,
  onBulkCampaign,
  showOutreachStatus = false,
  campaignStatus,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Map lead id to outreach status from campaignStatus
  const outreachMap = new Map();
  if (campaignStatus?.leads) {
    campaignStatus.leads.forEach((l: any) => {
      outreachMap.set(l.id, l.outreachStatus);
    });
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const getOutreachIcon = (status: OutreachStatus | undefined) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            ⏳ Pending
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-800" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Optimising & personalising…
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            ✈️ Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
            ✗ Failed
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            – Skipped
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">—</span>;
    }
  };

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b">
          <span className="text-sm text-gray-700">
            {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="space-x-2">
            {onBulkCampaign && (
              <button
                onClick={() => onBulkCampaign(Array.from(selectedIds))}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                🚀 Add to Campaign
              </button>
            )}
            {onBulkDelete && (
              <button
                onClick={() => {
                  if (confirm(`Delete ${selectedIds.size} lead(s)?`)) {
                    onBulkDelete(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }
                }}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              {showOutreachStatus && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outreach</th>
              )}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-3 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {lead.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.company || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.position || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[lead.status]}`}>
                    {lead.status}
                  </span>
                </td>
                {showOutreachStatus && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getOutreachIcon(outreachMap.get(lead.id) || lead.outreachStatus)}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onDelete(lead.id)}
                    className="text-red-600 hover:text-red-900 ml-2"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};