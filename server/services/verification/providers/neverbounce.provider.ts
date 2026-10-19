import { logger } from '../../../config/logger';
import { VerificationProvider, VerificationResult } from '../types';

/**
 * NeverBounce bulk verification (v4 Jobs API).
 *
 * Implemented against NeverBounce's documented v4 REST shape
 * (jobs/create -> jobs/status -> jobs/results). This is inert until
 * NEVERBOUNCE_API_KEY is set — verify field names against NeverBounce's
 * current docs before flipping VERIFICATION_PROVIDER=neverbounce in
 * production, as third-party API surfaces change over time.
 */
export class NeverBounceProvider implements VerificationProvider {
  readonly name = 'neverbounce';
  private readonly baseUrl = 'https://api.neverbounce.com/v4';

  isConfigured(): boolean {
    return !!process.env.NEVERBOUNCE_API_KEY;
  }

  async submitBulkJob(emails: string[]): Promise<string> {
    const apiKey = process.env.NEVERBOUNCE_API_KEY;
    if (!apiKey) throw new Error('NEVERBOUNCE_API_KEY is not configured');

    const res = await fetch(`${this.baseUrl}/jobs/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: apiKey,
        input: emails.map((email, i) => ({ id: i, email })),
        input_location: 'supplied',
        auto_start: true,
        auto_parse: false,
      }),
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'NeverBounce job submission failed');
    return String(data.job_id);
  }

  async getBulkJobResults(
    jobId: string,
    _originalEmails: string[]
  ): Promise<{ isComplete: boolean; results: VerificationResult[] }> {
    const apiKey = process.env.NEVERBOUNCE_API_KEY;
    if (!apiKey) throw new Error('NEVERBOUNCE_API_KEY is not configured');

    try {
      const statusRes = await fetch(
        `${this.baseUrl}/jobs/status?key=${apiKey}&job_id=${jobId}`
      );
      const statusData = await statusRes.json();

      if (statusData.job_status !== 'complete') {
        return { isComplete: false, results: [] };
      }

      const resultsRes = await fetch(
        `${this.baseUrl}/jobs/results?key=${apiKey}&job_id=${jobId}&limit=${10000}`
      );
      const resultsData = await resultsRes.json();

      const results: VerificationResult[] = (resultsData.results || []).map((r: any) => {
        let mapped: VerificationResult['status'] = 'INVALID';
        if (r.result === 'valid') mapped = 'VALID';
        if (r.result === 'catchall') mapped = 'CATCH_ALL';
        // 'invalid', 'disposable', 'unknown' -> treated as INVALID (conservative)
        return { email: r.email, status: mapped };
      });

      return { isComplete: true, results };
    } catch (error) {
      logger.error({ error }, 'Failed to get NeverBounce job results');
      throw error;
    }
  }
}
