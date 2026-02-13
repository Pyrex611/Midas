import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { leadAPI } from '../services/api';
import { UploadSummary, UploadPreviewResponse, Lead, EmailCandidate } from '../types/lead';
import { EmailSelectionModal } from './EmailSelectionModal';

interface Props {
  onUploadComplete: (summary: UploadSummary, leads: Lead[]) => void;
}

interface SelectedFile {
  id: string;
  file: File;
  progress?: 'pending' | 'uploading' | 'success' | 'error';
  summary?: UploadSummary;
  error?: string;
}

export const UploadArea: React.FC<Props> = ({ onUploadComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Email conflict resolution state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailCandidates, setEmailCandidates] = useState<any[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState<string>('');
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Limit to 5 files total
    const newFiles = acceptedFiles.slice(0, 5 - selectedFiles.length).map(file => ({
      id: Math.random().toString(36).substring(2),
      file,
      progress: 'pending' as const,
    }));
    setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 5));
  }, [selectedFiles.length]);

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024,
  });

  const uploadFile = async (fileItem: SelectedFile) => {
    setSelectedFiles(prev =>
      prev.map(f => f.id === fileItem.id ? { ...f, progress: 'uploading', error: undefined } : f)
    );

    try {
      const res = await leadAPI.upload(fileItem.file, skipDuplicates);
      const data: UploadPreviewResponse = res.data;
      const sessionId = res.headers['x-upload-session'];

      if (data.needsEmailSelection && data.emailCandidates && sessionId) {
        // Store session and pause upload chain
        setEmailCandidates(data.emailCandidates);
        setUploadSessionId(sessionId);
        setPendingFileId(fileItem.id);
        setShowEmailModal(true);
        setUploading(false);
        return; // pause further uploads
      } else {
        // No conflicts – success
        setSelectedFiles(prev =>
          prev.map(f => f.id === fileItem.id ? { 
            ...f, 
            progress: 'success', 
            summary: data.summary 
          } : f)
        );
        // Fetch the actual leads that were just created (for preview)
        // Since we don't have the leads in the response, we need to fetch the latest leads.
        // We'll call a new endpoint or rely on the fact that the leads are now in DB.
        // For simplicity, we'll fetch the first page of leads.
        const leadsRes = await leadAPI.getAll(1, 10);
        onUploadComplete(data.summary, leadsRes.data.data);
        return true;
      }
    } catch (err: any) {
      setSelectedFiles(prev =>
        prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          progress: 'error', 
          error: err.response?.data?.error || err.message 
        } : f)
      );
      return false;
    }
  };

  const handleUploadAll = async () => {
    setUploading(true);
    const pending = selectedFiles.filter(f => f.progress === 'pending');
    for (const fileItem of pending) {
      const shouldContinue = await uploadFile(fileItem);
      if (shouldContinue === false) break; // stop on error or if modal opened
    }
    setUploading(false);
  };

  const handleEmailConfirm = async (selections: { rowIndex: number; selectedEmail: string }[]) => {
    setShowEmailModal(false);
    if (!pendingFileId) return;

    try {
      const res = await leadAPI.confirmEmailSelection(uploadSessionId, selections);
      setSelectedFiles(prev =>
        prev.map(f => f.id === pendingFileId ? {
          ...f,
          progress: 'success',
          summary: {
            totalRows: emailCandidates.length,
            valid: emailCandidates.length,
            created: res.data.summary.created,
            duplicates: res.data.summary.duplicates,
            failed: res.data.summary.failed,
            parseErrors: [],
            dbErrors: res.data.summary.errors || [],
          }
        } : f)
      );
      const leadsRes = await leadAPI.getAll(1, 10);
      onUploadComplete(res.data.summary, leadsRes.data.data);
    } catch (err: any) {
      setSelectedFiles(prev =>
        prev.map(f => f.id === pendingFileId ? {
          ...f,
          progress: 'error',
          error: err.response?.data?.error || err.message
        } : f)
      );
    } finally {
      setPendingFileId(null);
      setEmailCandidates([]);
      setUploadSessionId('');
      // Resume uploading remaining files
      setUploading(true);
      const remaining = selectedFiles.filter(f => f.progress === 'pending' && f.id !== pendingFileId);
      for (const fileItem of remaining) {
        await uploadFile(fileItem);
      }
      setUploading(false);
    }
  };

  return (
    <>
      <div className="bg-white shadow sm:rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="mr-2"
            />
            Skip duplicate emails
          </label>
          <span className="text-xs text-gray-500">
            {selectedFiles.length}/5 files selected
          </span>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200 mb-4
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${selectedFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} disabled={selectedFiles.length >= 5} />
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H8a4 4 0 01-4-4v-8m32 0l-8-8m8 8l-8 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-2 text-sm text-gray-600">
            {isDragActive ? 'Drop the files here' : 'Drag & drop or click to select'}
          </p>
          <p className="mt-1 text-xs text-gray-500">CSV, TXT, XLSX up to 10MB each (max 5 files)</p>
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Files</h3>
            <ul className="space-y-2">
              {selectedFiles.map((fileItem) => (
                <li key={fileItem.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center space-x-3">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{fileItem.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(fileItem.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {fileItem.progress === 'uploading' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                    {fileItem.progress === 'success' && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Uploaded</span>
                    )}
                    {fileItem.progress === 'error' && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full" title={fileItem.error}>Failed</span>
                    )}
                    {fileItem.progress === 'pending' && !uploading && (
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload button */}
        <div className="flex justify-end">
          <button
            onClick={handleUploadAll}
            disabled={uploading || selectedFiles.filter(f => f.progress === 'pending').length === 0}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      </div>

      <EmailSelectionModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        candidates={emailCandidates}
        onConfirm={handleEmailConfirm}
      />
    </>
  );
};