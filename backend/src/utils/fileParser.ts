import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { LeadCreateInput, EmailCandidate } from '../types/lead.types';

export interface ParseResult {
  leads: LeadCreateInput[];
  emailCandidates?: { rowIndex: number; candidates: EmailCandidate[] }[];
  errors: { row: number; message: string }[];
}

/**
 * Smart column mapper that detects columns using keyword matching.
 * Handles full name, first/last name, multiple email columns with type inference,
 * company, and position.
 */
class ColumnMapper {
  private headers: string[];
  private nameCols: { type: 'full' | 'first' | 'last'; index: number }[] = [];
  private emailCols: { index: number; type: string; priority: number }[] = [];
  private companyCols: number[] = [];
  private positionCols: number[] = [];

  constructor(headers: string[]) {
    this.headers = headers.map(h => h.trim().toLowerCase());
    this.analyze();
  }

  private analyze() {
    this.headers.forEach((header, idx) => {
      // ----- NAME DETECTION -----
      if (/\b(full ?name|name)\b/.test(header) && !header.includes('company')) {
        this.nameCols.push({ type: 'full', index: idx });
      } else if (/\bfirst ?name\b/.test(header)) {
        this.nameCols.push({ type: 'first', index: idx });
      } else if (/\blast ?name\b/.test(header)) {
        this.nameCols.push({ type: 'last', index: idx });
      }

      // ----- EMAIL DETECTION WITH TYPE INFERENCE -----
      if (header.includes('email')) {
        let type = 'other';
        let priority = 10;

        if (header.includes('work') || header.includes('professional') || header.includes('company')) {
          type = 'work';
          priority = 1;
        }
        if (header.includes('personal') || header.includes('private') || header.includes('home')) {
          type = 'personal';
          priority = 2;
        }
        if (header.includes('direct')) {
          type = 'direct';
          priority = 3;
        }
        if (header.includes('#1') || header.includes('primary')) {
          priority = 0; // highest
        }

        this.emailCols.push({ index: idx, type, priority });
      }

      // ----- COMPANY DETECTION -----
      if (/\b(company|organization|account|employer)\b/.test(header)) {
        this.companyCols.push(idx);
      }

      // ----- POSITION DETECTION -----
      if (/\b(job ?title|title|position|designation|role)\b/.test(header)) {
        this.positionCols.push(idx);
      }
    });

    // Sort email columns by priority (lower = better)
    this.emailCols.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Extract name from a row, combining first+last if available.
   */
  extractName(row: any[]): string | null {
    // Prefer full name column
    const fullNameCol = this.nameCols.find(c => c.type === 'full');
    if (fullNameCol !== undefined) {
      const val = row[fullNameCol.index]?.trim();
      if (val && val.length > 0) return val;
    }

    // Try to combine first + last
    const firstCol = this.nameCols.find(c => c.type === 'first');
    const lastCol = this.nameCols.find(c => c.type === 'last');
    if (firstCol && lastCol) {
      const first = row[firstCol.index]?.trim() || '';
      const last = row[lastCol.index]?.trim() || '';
      if (first || last) return `${first} ${last}`.trim();
    } else if (firstCol) {
      const first = row[firstCol.index]?.trim();
      if (first) return first;
    } else if (lastCol) {
      const last = row[lastCol.index]?.trim();
      if (last) return last;
    }

    return null;
  }

  /**
   * Extract ALL email candidates from a row.
   */
  extractEmailCandidates(row: any[]): EmailCandidate[] {
    const candidates: EmailCandidate[] = [];
    for (const col of this.emailCols) {
      const val = row[col.index]?.trim();
      if (val && isValidEmail(val)) {
        candidates.push({
          email: val,
          type: col.type,
        });
      }
    }
    // Remove duplicates (same email, keep first occurrence)
    const seen = new Set<string>();
    return candidates.filter(c => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });
  }

  /**
   * Extract company name.
   */
  extractCompany(row: any[]): string | null {
    for (const idx of this.companyCols) {
      const val = row[idx]?.trim();
      if (val) return val;
    }
    return null;
  }

  /**
   * Extract job position.
   */
  extractPosition(row: any[]): string | null {
    for (const idx of this.positionCols) {
      const val = row[idx]?.trim();
      if (val) return val;
    }
    return null;
  }

  /**
   * Check if we have at least some capability to extract name and email.
   */
  hasEssentialCapability(): boolean {
    return this.nameCols.length > 0 && this.emailCols.length > 0;
  }
}

/**
 * Validate email format.
 */
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Parse uploaded file (CSV, TXT, XLSX) into leads and email candidates.
 */
export async function parseLeadFile(
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  const errors: ParseResult['errors'] = [];
  let rows: any[] = [];

  // ----- PARSE FILE BASED ON MIME TYPE -----
  try {
    if (mimeType.includes('csv') || mimeType.includes('text/plain')) {
      const csvString = buffer.toString('utf-8');
      const { data, errors: parseErrors } = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
      });
      if (parseErrors.length) {
        parseErrors.forEach(err => {
          errors.push({ row: err.row + 1, message: `CSV parse error: ${err.message}` });
        });
      }
      rows = data;
    } else if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('xlsx')
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet);
    } else {
      throw new Error('Unsupported file type');
    }
  } catch (err: any) {
    errors.push({ row: 0, message: `File parsing failed: ${err.message}` });
    return { leads: [], errors };
  }

  if (rows.length === 0) {
    errors.push({ row: 0, message: 'File contains no data rows' });
    return { leads: [], errors };
  }

  // ----- GET HEADERS FROM FIRST OBJECT KEYS -----
  const headers = Object.keys(rows[0]);
  if (headers.length === 0) {
    errors.push({ row: 0, message: 'No column headers found' });
    return { leads: [], errors };
  }

  const mapper = new ColumnMapper(headers);

  // ----- EARLY WARNING IF ESSENTIAL COLUMNS MISSING -----
  if (!mapper.hasEssentialCapability()) {
    const missing = [];
    if (mapper.nameCols.length === 0) missing.push('name');
    if (mapper.emailCols.length === 0) missing.push('email');
    errors.push({
      row: 0,
      message: `Could not identify columns for: ${missing.join(', ')}. Please ensure your file contains columns like "Name", "Email", etc.`,
    });
    // We still try to process rows; they will mostly fail, but at least user knows why.
  }

  const leads: LeadCreateInput[] = [];
  const emailCandidates: { rowIndex: number; candidates: EmailCandidate[] }[] = [];

  rows.forEach((row, idx) => {
    const rowValues = headers.map(h => row[h]?.toString() || '');
    const rowNumber = idx + 1;

    // Extract fields using the smart mapper
    const name = mapper.extractName(rowValues);
    const company = mapper.extractCompany(rowValues);
    const position = mapper.extractPosition(rowValues);
    const candidates = mapper.extractEmailCandidates(rowValues);

    // ----- VALIDATION & ERROR COLLECTION -----
    let rowValid = true;
    const rowErrors: string[] = [];

    if (!name) {
      rowErrors.push('Missing or invalid name');
      rowValid = false;
    }
    if (candidates.length === 0) {
      rowErrors.push('No valid email found');
      rowValid = false;
    }

    if (!rowValid) {
      errors.push({ row: rowNumber, message: rowErrors.join('; ') });
      return;
    }

    // TEMPORARY: store the first candidate as default email.
    // If multiple candidates exist, we will later ask user to choose.
    const primaryEmail = candidates[0].email;
    leads.push({
      name: name!.trim().slice(0, 255),
      email: primaryEmail.toLowerCase().slice(0, 255),
      company: company?.trim().slice(0, 255) || null,
      position: position?.trim().slice(0, 255) || null,
    });

    // If more than one candidate, record them for conflict resolution
    if (candidates.length > 1) {
      emailCandidates.push({
        rowIndex: idx,
        candidates: candidates.map(c => ({
          email: c.email.toLowerCase(),
          type: c.type,
        })),
      });
    }
  });

  return {
    leads,
    emailCandidates: emailCandidates.length > 0 ? emailCandidates : undefined,
    errors,
  };
}