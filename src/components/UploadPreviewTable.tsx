import React from 'react';
import { Lead } from '../types/lead';

interface Props {
  leads: Lead[];
}

export const UploadPreviewTable: React.FC<Props> = ({ leads }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td className="px-4 py-3 text-sm text-gray-900">{lead.name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{lead.email}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{lead.company || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{lead.position || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};