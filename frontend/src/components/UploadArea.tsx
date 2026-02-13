import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { leadAPI } from '../services/api';
import { UploadSummary, Lead } from '../types/lead';

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
  const [fatalError, setFatalError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFatalError(null);
    const newFiles = acceptedFiles.slice(0, 5 - selectedFiles.length).map(file => ({
      id: Math.random().toString(36).substring(2),
      file,
      progress: 'pending' as const,
    }));
    setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 5));
  }, [selectedFiles.length]);

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
    setFatalError(null);
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
    setFatalError(null);

    try {
      const res = await leadAPI.upload(fileItem.file, skipDuplicates);
      const data = res.data;

      setSelectedFiles(prev =>
        prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          progress: 'success', 
          summary: data.summary 
        } : f)
      );

      // Fetch preview of recent leads
      const leadsRes = await leadAPI.getAll(1, 10);
      onUploadComplete(data.summary, leadsRes.data.data);
      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message;
      setFatalError(errorMessage);
      setSelectedFiles(prev =>
        prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          progress: 'error', 
          error: errorMessage 
        } : f)
      );
      return false;
    }
  };

  const handleUploadAll = async () => {
    setUploading(true);
    setFatalError(null);
    const pending = selectedFiles.filter(f => f.progress === 'pending');
    for (const fileItem of pending) {
      await uploadFile(fileItem);
    }
    setUploading(false);
  };

  return (
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

      {fatalError && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Upload Failed</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{fatalError}</p>
                {fatalError.includes('database') && (
                  <p className="mt-2 font-medium">
                    ▶ Run: <code className="bg-red-200 px-1 py-0.5 rounded">npx prisma migrate dev</code> in the backend directory
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
  );
};