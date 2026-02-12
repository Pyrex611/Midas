import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { leadAPI } from '../services/api';
import { UploadSummary } from '../types/lead';

export const UploadArea: React.FC<{ onUploadSuccess: () => void }> = ({
  onUploadSuccess,
}) => {
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSummary(null);

    try {
      const res = await leadAPI.upload(file, skipDuplicates);
      setSummary(res.data.summary);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  }, [skipDuplicates, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className="bg-white shadow sm:rounded-lg p-6 mb-8">
      <div className="mb-4 flex items-center">
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            className="mr-2"
          />
          Skip duplicate emails
        </label>
      </div>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-600">Uploading and processing...</p>
          </div>
        ) : (
          <>
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H8a4 4 0 01-4-4v-8m32 0l-8-8m8 8l-8 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive ? 'Drop the file here' : 'Drag & drop or click to select'}
            </p>
            <p className="mt-1 text-xs text-gray-500">CSV, TXT, XLSX up to 10MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
          ❌ {error}
        </div>
      )}

      {summary && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h4 className="font-medium text-gray-900 mb-2">Upload Summary</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Total rows:</dt>
            <dd className="font-medium">{summary.totalRows}</dd>
            <dt className="text-gray-500">Valid leads:</dt>
            <dd className="font-medium">{summary.valid}</dd>
            <dt className="text-gray-500">Created:</dt>
            <dd className="font-medium text-green-600">{summary.created}</dd>
            <dt className="text-gray-500">Duplicates skipped:</dt>
            <dd className="font-medium text-yellow-600">{summary.duplicates}</dd>
            <dt className="text-gray-500">Failed:</dt>
            <dd className="font-medium text-red-600">{summary.failed}</dd>
          </dl>
          {summary.parseErrors.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-700 mb-1">Parse errors:</p>
              <ul className="text-xs text-red-600 list-disc list-inside">
                {summary.parseErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>Row {e.row}: {e.message}</li>
                ))}
                {summary.parseErrors.length > 5 && (
                  <li>...and {summary.parseErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};