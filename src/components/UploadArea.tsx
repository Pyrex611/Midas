import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { leadAPI, configAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

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
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [uploading, setUploading] = useState(false);
  const [verifyEmails, setVerifyEmails] = useState(false);
  const [verificationAvailable, setVerificationAvailable] = useState(false);
  const [verificationProvider, setVerificationProvider] = useState<string>('mock');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await leadAPI.getJobs();
      const currentJobs: Job[] = res.data || [];
      setJobs(currentJobs);

      const hasActive = currentJobs.some((j: Job) => ['PENDING', 'PROCESSING', 'VERIFYING'].includes(j.status));
      if (hasActive) {
        pollTimerRef.current = setTimeout(fetchJobs, 3500);
      } else {
        onJobComplete();
      }
    } catch (e) {
      console.error('Failed to poll upload jobs', e);
    }
  };

  useEffect(() => {
    fetchJobs();
    configAPI.get()
      .then(res => {
        setVerificationAvailable(!!res.data?.verification?.available);
        setVerificationProvider(res.data?.verification?.provider || 'mock');
      })
      .catch(() => setVerificationAvailable(false));

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    const file = acceptedFiles[0];
    try {
      await leadAPI.upload(file, verificationAvailable && verifyEmails);
      toast.success(`Uploaded ${file.name} for ingestion`, 'Processing Started');
      await fetchJobs();
    } catch {
      toast.error('File upload failed. Check CSV/XLSX formatting.', 'Upload Error');
    } finally {
      setUploading(false);
    }
  }, [verifyEmails, verificationAvailable]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">COMPLETED</span>;
      case 'FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">FAILED</span>;
      case 'VERIFYING':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 animate-pulse">VERIFYING</span>;
      case 'PROCESSING':
      case 'PENDING':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 animate-pulse">PROCESSING</span>;
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div>
        <h2 className="text-lg font-black text-zinc-900 tracking-tight">Lead Ingestion Studio</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Upload prospect lists in CSV or Excel format. Suppression rules and deduplication apply automatically.</p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
            : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50 hover:bg-zinc-50'
        }`}
      >
        <input {...getInputProps()} disabled={uploading} />
        <div className="w-10 h-10 rounded-2xl bg-white border border-zinc-200 shadow-xs text-zinc-500 mx-auto flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-xs font-bold text-zinc-800">
          {uploading ? 'Parsing and staging lead records...' : isDragActive ? 'Drop file here to import' : 'Drag & drop prospect CSV/XLSX, or click to browse'}
        </p>
        <p className="text-[11px] text-zinc-400 mt-1">Supports auto-detection for Name, Email, Company, and Title columns (Max 10MB).</p>
      </div>

      {/* Verification Option */}
      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            id="verify-emails-checkbox"
            type="checkbox"
            checked={verifyEmails}
            disabled={!verificationAvailable || uploading}
            onChange={(e) => setVerifyEmails(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-0 disabled:opacity-40"
          />
          <div>
            <label htmlFor="verify-emails-checkbox" className={`text-xs font-bold ${verificationAvailable ? 'text-zinc-800' : 'text-zinc-400'}`}>
              Verify Deliverability Before Ingestion
            </label>
            <p className="text-[11px] text-zinc-400">
              {verificationAvailable
                ? `Active provider: ${verificationProvider.toUpperCase()} · filters invalid mailboxes to safeguard reputation.`
                : 'No external verification API key configured. Leads will be staged as UNVERIFIED.'}
            </p>
          </div>
        </div>
        {verificationAvailable && (
          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
            Engine Ready
          </span>
        )}
      </div>

      {/* Recent Ingestion Activity */}
      {jobs.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Recent Ingestion Batches</h3>
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-zinc-900 font-mono">{job.filename}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Valid: <span className="font-bold text-zinc-800">{job.validLeads}</span> ·
                    Catch-All: <span className="font-bold text-zinc-800">{job.catchAllLeads}</span> ·
                    Invalid: <span className="font-bold text-zinc-800">{job.invalidLeads}</span> ·
                    Suppressed: <span className="font-bold text-zinc-800">{job.blockedLeads}</span> ·
                    Duplicates: <span className="font-bold text-zinc-800">{job.duplicates}</span>
                  </p>
                </div>
                <div>{getStatusBadge(job.status)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};