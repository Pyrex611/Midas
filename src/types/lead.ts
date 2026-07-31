export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'FOLLOW_UP'
  | 'REPLIED'
  | 'UNSUBSCRIBED'
  | 'BOUNCED';

export type OutreachStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED';

export interface Lead {
  id: string;
  name: string;
  email: string;
  secondaryEmail?: string | null;
  company: string | null;
  position: string | null;
  status: LeadStatus;
  outreachStatus?: OutreachStatus; // ✅ ADDED
  campaignId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCandidate {
  email: string;
  type: string;
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

export interface UploadPreviewResponse {
  success: boolean;
  summary: UploadSummary;
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