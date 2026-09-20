import { logger } from '../../../config/logger';
import { VerificationProvider, VerificationResult } from '../types';

export class BounceBanProvider implements VerificationProvider {
  readonly name = 'bounceban';

  isConfigured(): boolean {
    return !!process.env.BOUNCEBAN_API_KEY;
  }

  async submitBulkJob(emails: string[]): Promise<string> {
    const apiKey = process.env.BOUNCEBAN_API_KEY;
    if (!apiKey) throw new Error('BOUNCEBAN_API_KEY is not configured');

    const res = await fetch('https://api.bounceban.com/v1/verify/bulk', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'BounceBan job submission failed');
    return data.job_id;
  }

  async getBulkJobResults(
    jobId: string,
    _originalEmails: string[]
  ): Promise<{ isComplete: boolean; results: VerificationResult[] }> {
    const apiKey = process.env.BOUNCEBAN_API_KEY;
    if (!apiKey) throw new Error('BOUNCEBAN_API_KEY is not configured');

    try {
      const res = await fetch(`https://api.bounceban.com/v1/verify/bulk/${jobId}`, {
        headers: { 'Authorization': apiKey },
      });
      const data = await res.json();

      if (data.status === 'processing') return { isComplete: false, results: [] };

      const results: VerificationResult[] = data.results.map((r: any) => {
        let mapped: VerificationResult['status'] = 'INVALID';
        if (r.status === 'deliverable') mapped = 'VALID';
        if (r.status === 'catch-all') mapped = 'CATCH_ALL';
        return { email: r.email, status: mapped };
      });

      return { isComplete: true, results };
    } catch (error) {
      logger.error({ error }, 'Failed to get BounceBan job results');
      throw error;
    }
  }
}
