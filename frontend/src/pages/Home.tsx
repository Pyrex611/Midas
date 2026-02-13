import React, { useState } from 'react';
import { UploadArea } from '../components/UploadArea';
import { UploadSummaryCard } from '../components/UploadSummaryCard';
import { UploadPreviewTable } from '../components/UploadPreviewTable';
import { UploadSummary, Lead } from '../types/lead';

export const Home: React.FC = () => {
  const [uploadHistory, setUploadHistory] = useState<UploadSummary[]>([]);
  const [previewLeads, setPreviewLeads] = useState<Lead[]>([]);

  const handleUploadComplete = (summary: UploadSummary, leads: Lead[]) => {
    setUploadHistory(prev => [summary, ...prev].slice(0, 5)); // keep last 5 summaries
    setPreviewLeads(leads.slice(0, 10)); // show first 10 leads from this upload
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Lead Upload
      </h1>

      <UploadArea onUploadComplete={handleUploadComplete} />

      {/* Horizontal summary cards */}
      {uploadHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Uploads</h2>
          <div className="flex overflow-x-auto space-x-4 pb-4">
            {uploadHistory.map((summary, idx) => (
              <UploadSummaryCard key={idx} summary={summary} />
            ))}
          </div>
        </div>
      )}

      {/* Preview of current upload */}
      {previewLeads.length > 0 && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Preview – Latest Upload (first 10 leads)
          </h2>
          <UploadPreviewTable leads={previewLeads} />
        </div>
      )}
    </div>
  );
};