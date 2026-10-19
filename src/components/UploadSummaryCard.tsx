import React from 'react';
import { UploadSummary } from '../types/lead';

interface Props {
  summary: UploadSummary;
}

export const UploadSummaryCard: React.FC<Props> = ({ summary }) => {
  return (
    <div className="flex-none w-64 bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="text-xs text-gray-500 mb-2">
        {new Date().toLocaleTimeString()} {/* In real app, use timestamp from summary */}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-600">Valid</div>
        <div className="font-medium text-right">{summary.valid}</div>
        <div className="text-gray-600">Created</div>
        <div className="font-medium text-right text-green-600">{summary.created}</div>
        <div className="text-gray-600">Duplicates</div>
        <div className="font-medium text-right text-yellow-600">{summary.duplicates}</div>
        <div className="text-gray-600">Failed</div>
        <div className="font-medium text-right text-red-600">{summary.failed}</div>
      </div>
    </div>
  );
};