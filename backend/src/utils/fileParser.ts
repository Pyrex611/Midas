import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { LeadCreateInput } from '../types/lead.types';

export interface ParseResult {
  leads: LeadCreateInput[];
  errors: { row: number; message: string }[];
}

export async function parseLeadFile(
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  const errors: ParseResult['errors'] = [];
  let rows: any[] = [];

  if (mimeType.includes('csv') || mimeType.includes('text/plain')) {
    const csvString = buffer.toString('utf-8');
    const { data } = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
    });
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

  const leads: LeadCreateInput[] = [];
  rows.forEach((row, idx) => {
    // Normalise column names (lowercase, trim)
    const normalized = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v])
    );

    const name = normalized.name || normalized.fullname || normalized.full_name;
    const email = normalized.email;
    const company = normalized.company || normalized.company_name;
    const position = normalized.position || normalized.title || normalized.job_title;

    if (!name || typeof name !== 'string') {
      errors.push({ row: idx + 1, message: 'Missing or invalid name' });
      return;
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      errors.push({ row: idx + 1, message: 'Missing or invalid email' });
      return;
    }

    leads.push({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || null,
      position: position?.trim() || null,
    });
  });

  return { leads, errors };
}

function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}