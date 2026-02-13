import { z } from 'zod';

// ------------------------------------------------------------------
// 1. Lead Status – used across the entire system
// ------------------------------------------------------------------
export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'FOLLOW_UP'
  | 'REPLIED'
  | 'UNSUBSCRIBED'
  | 'BOUNCED';

// ------------------------------------------------------------------
// 2. Lead creation schema (for CSV/Excel uploads)
// ------------------------------------------------------------------
export const LeadCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  company: z.string().max(255).nullable().optional(),
  position: z.string().max(255).nullable().optional(),
});
export type LeadCreateInput = z.infer<typeof LeadCreateSchema>;

// ------------------------------------------------------------------
// 3. Lead update schema (partial updates)
// ------------------------------------------------------------------
export const LeadUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).nullable().optional(),
  position: z.string().max(255).nullable().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'FOLLOW_UP', 'REPLIED', 'UNSUBSCRIBED', 'BOUNCED']).optional(),
});
export type LeadUpdateInput = z.infer<typeof LeadUpdateSchema>;

// ------------------------------------------------------------------
// 4. Query schemas for upload and listing
// ------------------------------------------------------------------
export const UploadQuerySchema = z.object({
  skipDuplicates: z.enum(['true', 'false']).default('true'),
});

export const ListQuerySchema = z.object({
  page: z.string().default('1'),
  pageSize: z.string().default('20'),
  status: z.enum(['NEW', 'CONTACTED', 'FOLLOW_UP', 'REPLIED', 'UNSUBSCRIBED', 'BOUNCED']).optional(),
});

export interface EmailCandidate {
  email: string;
  type: string; // 'work', 'personal', 'direct', 'other'
}

// Extend Upload response type (used by frontend)
export interface UploadPreviewResponse {
  success: boolean;
  summary: {
    totalRows: number;
    valid: number;
    created: number; // will be 0 until final confirmation
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