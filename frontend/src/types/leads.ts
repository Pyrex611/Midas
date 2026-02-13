export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'FOLLOW_UP'
  | 'REPLIED'
  | 'UNSUBSCRIBED'
  | 'BOUNCED';

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  position: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UploadSummary {
  totalRows: number;
  valid: number;
  created: number;
  duplicates: number;
  failed: number;
  parseErrors: { row: number; message: string }[];
  dbErrors: any[];
}

export interface EmailCandidate {
  email: string;
  type: string;
}

export interface UploadPreviewResponse {
  success: boolean;
  summary: {
    totalRows: number;
    valid: number;
    created: number;
    duplicates: number;
    failed: number;
    parseErrors: any[];
    dbErrors: any[];
  };
  needsEmailSelection: boolean;
  emailCandidates?: {
    rowIndex: number;
    candidates: EmailCandidate[];
    leadPreview: {
      name: string;
      company: string | null;
      position: string | null;
    };
  }[];
}