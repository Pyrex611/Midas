import { VerificationProvider, VerificationResult } from '../types';

/**
 * Deterministic-enough fake verifier used whenever no real vendor is
 * configured, or a caller explicitly opts out of real verification.
 * Never blocks the upload pipeline waiting on a real HTTP job.
 */
export class MockVerificationProvider implements VerificationProvider {
  readonly name = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async submitBulkJob(_emails: string[]): Promise<string> {
    return `mock-job-${Date.now()}`;
  }

  async getBulkJobResults(
    _jobId: string,
    originalEmails: string[]
  ): Promise<{ isComplete: boolean; results: VerificationResult[] }> {
    // 80% VALID, 10% INVALID, 10% CATCH_ALL — matches prior mock behavior.
    const results: VerificationResult[] = originalEmails.map(email => {
      const rand = Math.random();
      let status: VerificationResult['status'] = 'VALID';
      if (rand > 0.9) status = 'CATCH_ALL';
      else if (rand > 0.8) status = 'INVALID';
      return { email, status };
    });
    return { isComplete: true, results };
  }
}
