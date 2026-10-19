import { logger } from '../../../config/logger';
import { VerificationProvider, VerificationResult } from '../types';

/**
 * ZeroBounce bulk verification (v2 file-based Bulk API).
 *
 * ZeroBounce's bulk endpoint is CSV-submission based rather than a plain
 * JSON array. Implemented against their documented `sendfile` / `filestatus`
 * / `getfile` v2 shape. Inert until ZEROBOUNCE_API_KEY is set — verify field
 * names against ZeroBounce's current docs before flipping
 * VERIFICATION_PROVIDER=zerobounce in production.
 */
export class ZeroBounceProvider implements VerificationProvider {
  readonly name = 'zerobounce';
  private readonly baseUrl = 'https://bulkapi.zerobounce.net/v2';

  isConfigured(): boolean {
    return !!process.env.ZEROBOUNCE_API_KEY;
  }

  async submitBulkJob(emails: string[]): Promise<string> {
    const apiKey = process.env.ZEROBOUNCE_API_KEY;
    if (!apiKey) throw new Error('ZEROBOUNCE_API_KEY is not configured');

    const csv = 'email\n' + emails.join('\n');
    const form = new FormData();
    form.append('api_key', apiKey);
    form.append('email_address_column', '1');
    form.append('has_header_row', 'true');
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'emails.csv');

    const res = await fetch(`${this.baseUrl}/sendfile`, { method: 'POST', body: form });
    const data = await res.json();
    if (!data.file_id) throw new Error(data.message || 'ZeroBounce file submission failed');
    return String(data.file_id);
  }

  async getBulkJobResults(
    jobId: string,
    _originalEmails: string[]
  ): Promise<{ isComplete: boolean; results: VerificationResult[] }> {
    const apiKey = process.env.ZEROBOUNCE_API_KEY;
    if (!apiKey) throw new Error('ZEROBOUNCE_API_KEY is not configured');

    try {
      const statusRes = await fetch(
        `${this.baseUrl}/filestatus?api_key=${apiKey}&file_id=${jobId}`
      );
      const statusData = await statusRes.json();

      if (statusData.file_status !== 'Complete') {
        return { isComplete: false, results: [] };
      }

      const csvRes = await fetch(`${this.baseUrl}/getfile?api_key=${apiKey}&file_id=${jobId}`);
      const csvText = await csvRes.text();

      const [header, ...rows] = csvText.trim().split('\n');
      const cols = header.split(',').map(c => c.trim().toLowerCase().replace(/"/g, ''));
      const emailIdx = cols.indexOf('email address');
      const statusIdx = cols.indexOf('zb status');

      const results: VerificationResult[] = rows.map(row => {
        const cells = row.split(',').map(c => c.replace(/"/g, ''));
        const rawStatus = (cells[statusIdx] || '').toLowerCase();
        let mapped: VerificationResult['status'] = 'INVALID';
        if (rawStatus === 'valid') mapped = 'VALID';
        if (rawStatus === 'catch-all') mapped = 'CATCH_ALL';
        return { email: cells[emailIdx], status: mapped };
      });

      return { isComplete: true, results };
    } catch (error) {
      logger.error({ error }, 'Failed to get ZeroBounce job results');
      throw error;
    }
  }
}
