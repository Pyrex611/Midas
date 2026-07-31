import { logger } from '../config/logger';

export interface VerificationResult {
  email: string;
  status: 'VALID' | 'INVALID' | 'CATCH_ALL';
}

export class VerificationService {
  
  async submitBulkJob(emails: string[]): Promise<string> {
    const apiKey = process.env.BOUNCEBAN_API_KEY;
    
    // Fallback Mock Logic if no key provided
    if (!apiKey) {
      logger.info('No BOUNCEBAN_API_KEY found, simulating bulk verification job.');
      return `mock-job-${Date.now()}`;
    }

    // Actual BounceBan Submit Logic
    // POST https://api.bounceban.com/v1/verify/bulk
    try {
      const res = await fetch('https://api.bounceban.com/v1/verify/bulk', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emails })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data.job_id;
    } catch (error) {
      logger.error({ error }, 'Failed to submit BounceBan job');
      throw error;
    }
  }

  async getBulkJobResults(jobId: string, originalEmails: string[]): Promise<{ isComplete: boolean, results: VerificationResult[] }> {
    const apiKey = process.env.BOUNCEBAN_API_KEY;

    if (!apiKey && jobId.startsWith('mock-job-')) {
      // Mock logic: 80% VALID, 10% INVALID, 10% CATCH_ALL
      const results: VerificationResult[] = originalEmails.map(email => {
        const rand = Math.random();
        let status: 'VALID' | 'INVALID' | 'CATCH_ALL' = 'VALID';
        if (rand > 0.9) status = 'CATCH_ALL';
        else if (rand > 0.8) status = 'INVALID';
        
        return { email, status };
      });
      return { isComplete: true, results };
    }

    try {
      const res = await fetch(`https://api.bounceban.com/v1/verify/bulk/${jobId}`, {
        headers: { 'Authorization': apiKey! }
      });
      const data = await res.json();
      
      if (data.status === 'processing') return { isComplete: false, results: [] };
      
      const results = data.results.map((r: any) => {
        let mappedStatus: 'VALID' | 'INVALID' | 'CATCH_ALL' = 'INVALID';
        if (r.status === 'deliverable') mappedStatus = 'VALID';
        if (r.status === 'catch-all') mappedStatus = 'CATCH_ALL';
        return { email: r.email, status: mappedStatus };
      });

      return { isComplete: true, results };
    } catch (error) {
      logger.error({ error }, 'Failed to get BounceBan job results');
      throw error;
    }
  }
}

export const verificationService = new VerificationService();