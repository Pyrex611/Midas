import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadArea } from '../components/UploadArea';
import { UploadSummaryCard } from '../components/UploadSummaryCard';
import { UploadPreviewTable } from '../components/UploadPreviewTable';
import { AddToCampaignModal } from '../components/AddToCampaignModal';
import { campaignAPI, diagnosticsAPI } from '../services/api';
import { UploadSummary, Lead } from '../types/lead';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [uploadHistory, setUploadHistory] = useState<UploadSummary[]>([]);
  const [previewLeads, setPreviewLeads] = useState<Lead[]>([]);
  const [lastUploadLeadIds, setLastUploadLeadIds] = useState<string[]>([]);
  const [isStartingCampaign, setIsStartingCampaign] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [checkingDb, setCheckingDb] = useState(false);

  // Campaign modal state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([]);

  const handleUploadComplete = (summary: UploadSummary, leads: Lead[]) => {
    setUploadHistory(prev => [summary, ...prev].slice(0, 5));
    setPreviewLeads(leads.slice(0, 10));
    setLastUploadLeadIds(leads.map(l => l.id));
  };

  const openCampaignModal = async () => {
    setIsStartingCampaign(true);
    try {
      const res = await campaignAPI.getAll();
      setAvailableCampaigns(res.data);
      setShowCampaignModal(true);
    } catch (error) {
      console.error('Failed to fetch campaigns', error);
      alert('Could not load campaigns. Please try again.');
    } finally {
      setIsStartingCampaign(false);
    }
  };

  const handleCampaignSuccess = (campaignId: string) => {
    setShowCampaignModal(false);
    navigate(`/leads?campaign=${campaignId}`);
  };

  const checkDatabase = async () => {
    setCheckingDb(true);
    setDbStatus(null);
    try {
      const res = await diagnosticsAPI.health();
      setDbStatus(res.data);
    } catch (err: any) {
      setDbStatus({ 
        error: err.response?.data?.error || err.message,
        hint: 'Run `npx prisma migrate dev` in the backend directory'
      });
    } finally {
      setCheckingDb(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Lead Upload</h1>
        <div className="flex space-x-3">
          <button
            onClick={checkDatabase}
            disabled={checkingDb}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
          >
            {checkingDb ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Checking...
              </>
            ) : (
              '🔍 Test Database'
            )}
          </button>
          {lastUploadLeadIds.length > 0 && (
            <button
              onClick={openCampaignModal}
              disabled={isStartingCampaign}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
            >
              {isStartingCampaign ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : (
                '🚀 Add to Outreach Campaign'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Database Status Display */}
      {dbStatus && (
        <div className={`mb-6 p-4 rounded-md ${
          dbStatus.error 
            ? 'bg-red-100 border border-red-400 text-red-700' 
            : dbStatus.status === 'healthy' 
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {dbStatus.error ? (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium">
                {dbStatus.error ? 'Database Connection Failed' : 'Database Healthy'}
              </h3>
              <div className="mt-1 text-sm whitespace-pre-wrap">
                {dbStatus.error ? (
                  <>
                    <p>{dbStatus.error}</p>
                    {dbStatus.hint && (
                      <p className="mt-2 font-medium">{dbStatus.hint}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p>Database: {dbStatus.database}</p>
                    <p>Leads: {dbStatus.counts?.leads ?? 0}</p>
                    <p>Campaigns: {dbStatus.counts?.campaigns ?? 0}</p>
                    <p>Drafts: {dbStatus.counts?.drafts ?? 0}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <UploadArea onUploadComplete={handleUploadComplete} />

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

      {previewLeads.length > 0 && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Preview – Latest Upload (first 10 leads)
          </h2>
          <UploadPreviewTable leads={previewLeads} />
        </div>
      )}

      {/* Campaign Selection Modal */}
      <AddToCampaignModal
        isOpen={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        leadIds={lastUploadLeadIds}
        availableCampaigns={availableCampaigns}
        onSuccess={handleCampaignSuccess}
      />
    </div>
  );
};