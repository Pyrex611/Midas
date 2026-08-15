import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { leadAPI } from '../services/api';

interface Job {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  validLeads: number;
  catchAllLeads: number;
  blockedLeads: number;
  invalidLeads: number;
  duplicates: number;
}

export const UploadArea: React.FC<{ onJobComplete: () => void }> = ({ onJobComplete }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await leadAPI.getJobs();
      setJobs(res.data);
      if (res.data.some((j: Job) => ['PENDING', 'PROCESSING', 'VERIFYING'].includes(j.status))) {
        setTimeout(fetchJobs, 4000);
      } else {
        onJobComplete();
      }
    } catch (e) {
      console.error('Failed to poll jobs', e);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    try {
      await leadAPI.upload(acceptedFiles[0]);
      await fetchJobs();
    } catch (error) {
      alert('Upload failed. Please check file format.');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
  });

  const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-green-100 text-green-800';
    if (status === 'FAILED') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800 animate-pulse';
  };

  return (
    <div className="bg-white shadow sm:rounded-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4">Import Leads</h2>
      
      <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
        <input {...getInputProps()} disabled={uploading} />
        <p className="text-sm text-gray-600">
          {uploading ? 'Uploading and processing...' : isDragActive ? 'Drop file here' : 'Drag & drop a CSV or Excel file, or click to browse'}
        </p>
      </div>

      {jobs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Imports & Verification Status</h3>
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{job.filename}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Valid: {job.validLeads} | Catch-All: {job.catchAllLeads} | Invalid: {job.invalidLeads} | Suppressed: {job.blockedLeads} | Duplicates: {job.duplicates}
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};