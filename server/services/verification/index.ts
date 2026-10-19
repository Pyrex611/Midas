import { logger } from '../../config/logger';
import { VerificationProvider, VerificationResult } from './types';
import { MockVerificationProvider } from './providers/mock.provider';
import { BounceBanProvider } from './providers/bounceban.provider';
import { NeverBounceProvider } from './providers/neverbounce.provider';
import { ZeroBounceProvider } from './providers/zerobounce.provider';

export type { VerificationResult } from './types';

/**
 * Adding a new vendor: create `./providers/<vendor>.provider.ts` implementing
 * `VerificationProvider`, register it in this map, and set
 * `VERIFICATION_PROVIDER=<vendor>` + its API key env var. Nothing else in the
 * app needs to change — leadQueue.service.ts only talks to this class.
 */
const PROVIDER_REGISTRY: Record<string, () => VerificationProvider> = {
  mock: () => new MockVerificationProvider(),
  bounceban: () => new BounceBanProvider(),
  neverbounce: () => new NeverBounceProvider(),
  zerobounce: () => new ZeroBounceProvider(),
};

export class VerificationService {
  private provider: VerificationProvider;
  private mock = new MockVerificationProvider();

  constructor() {
    const configuredName = (process.env.VERIFICATION_PROVIDER || 'mock').toLowerCase();
    const factory = PROVIDER_REGISTRY[configuredName] || PROVIDER_REGISTRY.mock;
    this.provider = factory();

    if (this.provider.name !== 'mock' && !this.provider.isConfigured()) {
      logger.warn(
        { provider: this.provider.name },
        'VERIFICATION_PROVIDER is set but its API key is missing — falling back to mock verification'
      );
    }
  }

  /**
   * True only when a REAL vendor is configured with valid credentials.
   * Drives the `verificationAvailable` flag returned by GET /api/config,
   * which is what the frontend uses to enable/disable the "Verify emails"
   * checkbox on upload — no frontend deploy needed when a key is added,
   * just set the env vars on the backend and redeploy it.
   */
  isAvailable(): boolean {
    return this.provider.name !== 'mock' && this.provider.isConfigured();
  }

  get providerName(): string {
    return this.isAvailable() ? this.provider.name : 'mock';
  }

  private activeProvider(): VerificationProvider {
    return this.isAvailable() ? this.provider : this.mock;
  }

  async submitBulkJob(emails: string[]): Promise<string> {
    return this.activeProvider().submitBulkJob(emails);
  }

  async getBulkJobResults(
    jobId: string,
    originalEmails: string[]
  ): Promise<{ isComplete: boolean; results: VerificationResult[] }> {
    return this.activeProvider().getBulkJobResults(jobId, originalEmails);
  }
}

export const verificationService = new VerificationService();
