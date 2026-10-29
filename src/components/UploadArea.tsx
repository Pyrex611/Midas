import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { leadAPI, configAPI, campaignAPI } from '../services/api';
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

interface ColumnMapping {
  email: string;
  nameMode: 'single' | 'split';
  nameCol: string;
  firstNameCol: string;
  lastNameCol: string;
  companyCol: string;
  positionCol: string;
}

interface UploadAreaProps {
  onJobComplete: () => void;
  campaignId?: string;
  allowCampaignSelection?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onJobComplete,
  campaignId,
  allowCampaignSelection = false,
}) => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [uploading, setUploading] = useState(false);
  const [verifyEmails, setVerifyEmails] = useState(false);
  const [verificationAvailable, setVerificationAvailable] = useState(false);
  const [verificationProvider, setVerificationProvider] = useState<string>('mock');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Campaign routing
  const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaignId || '');

  // Staged File & Interactive Mapping Studio State
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    email: '',
    nameMode: 'single',
    nameCol: '',
    firstNameCol: '',
    lastNameCol: '',
    companyCol: '',
    positionCol: '',
  });

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

    if (allowCampaignSelection && !campaignId) {
      campaignAPI.getAll()
        .then(res => setAvailableCampaigns(res.data || []))
        .catch(() => {});
    }

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [campaignId, allowCampaignSelection]);

  const analyzeFileHeaders = async (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      if (rawData.length < 1) return toast.error('File appears to be empty', 'Parsing Error');

      const headers = (rawData[0] || []).map((h: any) => String(h || '').trim().replace(/^\uFEFF/, '')).filter(Boolean);
      const samples: Record<string, string>[] = [];
      for (let i = 1; i <= Math.min(3, rawData.length - 1); i++) {
        const row = rawData[i];
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] ? String(row[idx]).trim() : ''; });
        samples.push(obj);
      }
      setupMappingStage(file, headers, samples);
    } else {
      Papa.parse(file, {
        header: true,
        preview: 4,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.meta.fields || results.meta.fields.length === 0) {
            return toast.error('No headers found in CSV file', 'Parsing Error');
          }
          const headers = results.meta.fields.map(h => h.trim().replace(/^\uFEFF/, '')).filter(Boolean);
          const samples = (results.data as any[]).slice(0, 3);
          setupMappingStage(file, headers, samples);
        },
        error: () => toast.error('Failed to parse CSV preview', 'Error'),
      });
    }
  };

  const setupMappingStage = (file: File, headers: string[], samples: Record<string, string>[]) => {
    setStagedFile(file);
    setDetectedHeaders(headers);
    setSampleRows(samples);

    const emailMatch = headers.find(h => /^(work_?email|corporate_?email|email_?address|email|primary_?email)$/i.test(h)) ||
                       headers.find(h => /email/i.test(h)) || '';

    const firstMatch = headers.find(h => /^(first_?name|first|fname)$/i.test(h)) || '';
    const lastMatch = headers.find(h => /^(last_?name|last|lname|surname)$/i.test(h)) || '';
    const fullMatch = headers.find(h => /^(full_?name|contact_?name|lead_?name|name)$/i.test(h) && !/company/i.test(h)) || '';

    const companyMatch = headers.find(h => /^(company_?name|company|organization|account_?name|account)$/i.test(h)) ||
                          headers.find(h => /company|org/i.test(h)) || '';

    const positionMatch = headers.find(h => /^(job_?title|title|position|role|designation)$/i.test(h)) ||
                          headers.find(h => /title|position/i.test(h)) || '';

    setMapping({
      email: emailMatch,
      nameMode: firstMatch && lastMatch ? 'split' : 'single',
      nameCol: fullMatch || headers.find(h => /name/i.test(h)) || '',
      firstNameCol: firstMatch,
      lastNameCol: lastMatch,
      companyCol: companyMatch,
      positionCol: positionMatch,
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    await analyzeFileHeaders(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
  });

  const handleConfirmAndUpload = async () => {
    if (!stagedFile) return;
    if (!mapping.email) {
      return toast.warning('Please select a column for the Email field', 'Validation Error');
    }

    setUploading(true);
    const targetCampaign = campaignId || selectedCampaignId || undefined;

    try {
      await leadAPI.upload(
        stagedFile,
        verificationAvailable && verifyEmails,
        JSON.stringify(mapping),
        targetCampaign
      );
      toast.success(`Staged ${stagedFile.name} for ingestion${targetCampaign ? ' into campaign' : ''}`, 'Ingestion Queued');
      setStagedFile(null);
      setDetectedHeaders([]);
      setSampleRows([]);
      await fetchJobs();
    } catch {
      toast.error('File upload failed. Check CSV formatting.', 'Upload Error');
    } finally {
      setUploading(false);
    }
  };

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
        <h2 className="text-lg font-black text-zinc-900 tracking-tight">
          {campaignId ? 'Import Leads Directly to Sequence' : 'Lead Ingestion Studio'}
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {campaignId
            ? 'Import prospect lists directly into this campaign. Uploaded leads are automatically queued for outreach.'
            : 'Upload prospect lists with visual field matching. Deduplication and suppression rules apply automatically.'}
        </p>
      </div>

      {/* Stage 1: File Dropzone */}
      {!stagedFile && (
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
            {uploading ? 'Processing file...' : isDragActive ? 'Drop file to analyze headers' : 'Drag & drop prospect CSV/XLSX, or click to browse'}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Headers will be auto-detected for interactive mapping before final insertion.
          </p>
        </div>
      )}

      {/* Stage 2: Interactive Field Matching */}
      {stagedFile && (
        <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Step 2: Field Matching</span>
              <h3 className="text-sm font-bold text-zinc-900 mt-0.5">Map File Columns to Prospect Fields</h3>
              <p className="text-xs text-zinc-500 font-mono">{stagedFile.name} ({(stagedFile.size / 1024).toFixed(1)} KB)</p>
            </div>
            <button
              onClick={() => { setStagedFile(null); setDetectedHeaders([]); setSampleRows([]); }}
              className="text-xs font-bold text-zinc-400 hover:text-rose-600 transition-colors"
            >
              ✕ Change File
            </button>
          </div>

          {/* Optional Campaign Assignment (if on Dashboard) */}
          {allowCampaignSelection && !campaignId && (
            <div className="p-3 bg-white border border-zinc-200 rounded-xl space-y-1">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase">
                Assign Upload Directly to a Campaign (Optional)
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none"
              >
                <option value="">-- None (Stage as Global Leads) --</option>
                {availableCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>
          )}

          {/* Mapping Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.email}
                onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Select Email Column --</option>
                {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Name Resolution</label>
              <div className="flex bg-zinc-200/70 p-1 rounded-xl mb-1.5">
                <button
                  type="button"
                  onClick={() => setMapping({ ...mapping, nameMode: 'single' })}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    mapping.nameMode === 'single' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  Full Name
                </button>
                <button
                  type="button"
                  onClick={() => setMapping({ ...mapping, nameMode: 'split' })}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    mapping.nameMode === 'split' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  First + Last
                </button>
              </div>

              {mapping.nameMode === 'single' ? (
                <select
                  value={mapping.nameCol}
                  onChange={(e) => setMapping({ ...mapping, nameCol: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-800 font-medium focus:outline-none"
                >
                  <option value="">-- Full Name Column --</option>
                  {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={mapping.firstNameCol}
                    onChange={(e) => setMapping({ ...mapping, firstNameCol: e.target.value })}
                    className="w-full px-2 py-2 bg-white border border-zinc-200 rounded-xl text-[11px] font-medium focus:outline-none"
                  >
                    <option value="">First</option>
                    {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select
                    value={mapping.lastNameCol}
                    onChange={(e) => setMapping({ ...mapping, lastNameCol: e.target.value })}
                    className="w-full px-2 py-2 bg-white border border-zinc-200 rounded-xl text-[11px] font-medium focus:outline-none"
                  >
                    <option value="">Last</option>
                    {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Company / Account</label>
              <select
                value={mapping.companyCol}
                onChange={(e) => setMapping({ ...mapping, companyCol: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-800 font-medium focus:outline-none"
              >
                <option value="">-- Optional Company --</option>
                {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Job Title / Role</label>
              <select
                value={mapping.positionCol}
                onChange={(e) => setMapping({ ...mapping, positionCol: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-800 font-medium focus:outline-none"
              >
                <option value="">-- Optional Position --</option>
                {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* Live Preview Table */}
          {sampleRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-200/80">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Live Sample Data Preview</span>
              <div className="overflow-x-auto bg-white border border-zinc-200 rounded-xl">
                <table className="min-w-full divide-y divide-zinc-100 text-left text-[11px]">
                  <thead className="bg-zinc-50 font-bold text-zinc-500">
                    <tr>
                      <th className="py-2 px-3">Resolved Email</th>
                      <th className="py-2 px-3">Resolved Name</th>
                      <th className="py-2 px-3">Company</th>
                      <th className="py-2 px-3">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                    {sampleRows.map((sample, idx) => {
                      const emailVal = mapping.email ? sample[mapping.email] : '—';
                      let nameVal = '—';
                      if (mapping.nameMode === 'split') {
                        const f = mapping.firstNameCol ? sample[mapping.firstNameCol] : '';
                        const l = mapping.lastNameCol ? sample[mapping.lastNameCol] : '';
                        nameVal = `${f} ${l}`.trim() || '—';
                      } else {
                        nameVal = mapping.nameCol ? sample[mapping.nameCol] || '—' : '—';
                      }
                      const compVal = mapping.companyCol ? sample[mapping.companyCol] || '—' : '—';
                      const posVal = mapping.positionCol ? sample[mapping.positionCol] || '—' : '—';

                      return (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono font-bold text-zinc-900">{emailVal}</td>
                          <td className="py-2 px-3">{nameVal}</td>
                          <td className="py-2 px-3 text-zinc-500">{compVal}</td>
                          <td className="py-2 px-3 text-zinc-500">{posVal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm Action */}
          <div className="pt-3 border-t border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                id="verify-leads-checkbox"
                type="checkbox"
                checked={verifyEmails}
                disabled={!verificationAvailable || uploading}
                onChange={(e) => setVerifyEmails(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-0 disabled:opacity-40"
              />
              <label htmlFor="verify-leads-checkbox" className="text-xs font-bold text-zinc-700 cursor-pointer">
                Verify Deliverability via {verificationProvider.toUpperCase()}
              </label>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => { setStagedFile(null); setDetectedHeaders([]); setSampleRows([]); }}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndUpload}
                disabled={uploading || !mapping.email}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                {uploading ? 'Staging & Ingesting...' : 'Confirm Mapping & Ingest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Ingestion Batches */}
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