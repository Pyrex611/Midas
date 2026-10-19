import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParseResult {
  leads: { name: string; email: string; company: string | null; position: string | null }[];
  errors: { row: number; message: string }[];
}

export class ColumnMapper {
  public nameCols: { type: 'full' | 'first' | 'last'; index: number }[] = [];
  public emailCols: { index: number; type: string; priority: number }[] = [];
  public companyCols: number[] = [];
  public positionCols: number[] = [];

  constructor(private headers: string[]) {
    this.headers = headers.map(h => h.trim().toLowerCase());
    this.analyze();
  }

  private analyze() {
    this.headers.forEach((header, idx) => {
      if (/\b(full ?name|name)\b/.test(header) && !header.includes('company')) {
        this.nameCols.push({ type: 'full', index: idx });
      } else if (/\bfirst ?name\b/.test(header)) {
        this.nameCols.push({ type: 'first', index: idx });
      } else if (/\blast ?name\b/.test(header)) {
        this.nameCols.push({ type: 'last', index: idx });
      }

      if (header.includes('email')) {
        let type = 'other';
        let priority = 10;
        if (header.includes('work') || header.includes('company')) { type = 'work'; priority = 1; }
        if (header.includes('personal')) { type = 'personal'; priority = 2; }
        this.emailCols.push({ index: idx, type, priority });
      }

      if (/\b(company|organization|account)\b/.test(header)) this.companyCols.push(idx);
      if (/\b(job ?title|title|position|role)\b/.test(header)) this.positionCols.push(idx);
    });

    this.emailCols.sort((a, b) => a.priority - b.priority);
  }

  extractName(row: string[]): string | null {
    const fullNameCol = this.nameCols.find(c => c.type === 'full');
    if (fullNameCol !== undefined) {
      const val = row[fullNameCol.index]?.trim();
      if (val) return val;
    }

    const firstCol = this.nameCols.find(c => c.type === 'first');
    const lastCol = this.nameCols.find(c => c.type === 'last');
    if (firstCol && lastCol) {
      const first = row[firstCol.index]?.trim() || '';
      const last = row[lastCol.index]?.trim() || '';
      if (first || last) return `${first} ${last}`.trim();
    }
    return null;
  }

  extractEmailCandidates(row: string[]): { email: string; type: string }[] {
    const candidates: { email: string; type: string }[] = [];
    for (const col of this.emailCols) {
      const val = row[col.index]?.trim();
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        candidates.push({ email: val, type: col.type });
      }
    }
    const seen = new Set<string>();
    return candidates.filter(c => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });
  }

  extractCompany(row: string[]): string | null {
    for (const idx of this.companyCols) {
      const val = row[idx]?.trim();
      if (val) return val;
    }
    return null;
  }

  extractPosition(row: string[]): string | null {
    for (const idx of this.positionCols) {
      const val = row[idx]?.trim();
      if (val) return val;
    }
    return null;
  }

  hasEssentialCapability(): boolean {
    return this.nameCols.length > 0 && this.emailCols.length > 0;
  }
}

export async function parseLeadFile(buffer: Buffer, mimeType: string): Promise<ParseResult> {
  const errors: ParseResult['errors'] = [];
  let rows: any[] = [];

  try {
    if (mimeType.includes('csv') || mimeType.includes('text/plain')) {
      const csvString = buffer.toString('utf-8');
      const { data, errors: parseErrors } = Papa.parse(csvString, { header: true, skipEmptyLines: true });
      parseErrors.forEach(err => {
        errors.push({ row: (err.row ?? 0) + 1, message: `CSV error: ${err.message}` });
      });
      rows = data;
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    }
  } catch (err: any) {
    errors.push({ row: 0, message: `File parsing failed: ${err.message}` });
    return { leads: [], errors };
  }

  if (rows.length === 0) return { leads: [], errors };

  const headers = Object.keys(rows[0]);
  const mapper = new ColumnMapper(headers);
  const leads: ParseResult['leads'] = [];

  rows.forEach((row, idx) => {
    const rowValues = headers.map(h => row[h]?.toString() || '');
    const name = mapper.extractName(rowValues);
    const candidates = mapper.extractEmailCandidates(rowValues);

    if (name && candidates.length > 0) {
      leads.push({
        name,
        email: candidates[0].email.toLowerCase(),
        company: mapper.extractCompany(rowValues),
        position: mapper.extractPosition(rowValues),
      });
    }
  });

  return { leads, errors };
}